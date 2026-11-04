-- =============================================================================
-- VELTUX · Reservas y avisos por email (piloto sin coste de mensajería)
--
--   · El código de reserva verifica el EMAIL. El teléfono se guarda, pero no
--     está verificado: nunca se marca phone_verified_at por esta vía.
--   · Como el teléfono no prueba identidad, una reserva pública no modifica el
--     email de un cliente existente: cada cita guarda su email de contacto.
--   · Los avisos van por email a appointments.contact_email o, si no hay, al
--     email de la ficha. Sin ninguno de los dos, no se encola nada.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Datos
-- -----------------------------------------------------------------------------
alter table public.appointments
  add column contact_email text check (contact_email is null or contact_email = lower(contact_email));

alter table public.clients
  add column email_verified_at timestamptz;

alter table public.notifications
  add column recipient_email text check (recipient_email is null or recipient_email = lower(recipient_email)),
  drop constraint notifications_check,
  add constraint notifications_has_recipient
    check (recipient_phone is not null or recipient_user_id is not null or recipient_email is not null);

alter table public.booking_otps
  alter column phone drop not null,
  add column email text check (email is null or email = lower(email));

create index booking_otps_email_idx on public.booking_otps (email, created_at desc);

-- La cita conserva el email de contacto aunque cambie de agenda.
create or replace function private.prepare_appointment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service public.services%rowtype;
begin
  if tg_op = 'INSERT' or new.service_id is distinct from old.service_id then
    select * into v_service from public.services s where s.id = new.service_id;
    new.service_name := v_service.name;
    new.price_cents  := v_service.price_cents;
    new.currency     := v_service.currency;
  end if;

  if tg_op = 'INSERT' then
    if not private.has_active_license(new.professional_id) then
      raise exception 'PROFESSIONAL_WITHOUT_LICENSE' using errcode = 'P0001';
    end if;
    new.created_by := coalesce(new.created_by, (select auth.uid()));
    if new.contact_email is null then
      select c.email into new.contact_email from public.clients c where c.id = new.client_id;
    end if;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Encolado: mantiene el nombre porque lo usan otras funciones; ahora encola email.
-- -----------------------------------------------------------------------------
create or replace function private.enqueue_client_sms(
  p_appointment_id uuid,
  p_template       text,
  p_key            text,
  p_extra          jsonb default '{}'::jsonb,
  p_when           timestamptz default now()
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications
    (salon_id, professional_id, appointment_id, channel, template, recipient_email, payload, idempotency_key, next_attempt_at)
  select a.salon_id, a.professional_id, a.id, 'email', p_template, coalesce(a.contact_email, c.email),
         jsonb_build_object(
           'starts_at', a.starts_at,
           'service_name', a.service_name,
           'salon_name', s.name,
           'professional_name', p.display_name,
           'timezone', s.timezone
         ) || p_extra,
         p_key, p_when
  from public.appointments a
  join public.clients c on c.id = a.client_id
  join public.salons s on s.id = a.salon_id
  join public.professionals p on p.id = a.professional_id
  where a.id = p_appointment_id
    and coalesce(a.contact_email, c.email) is not null
  on conflict (idempotency_key) do nothing;
$$;

create or replace function public.claim_pending_notifications(p_batch_size integer default 20)
returns setof public.notifications
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Un proceso caído no deja mensajes bloqueados para siempre.
  update public.notifications n
  set status = case when n.attempts >= n.max_attempts then 'failed'::public.notification_status else 'pending'::public.notification_status end,
      failed_at = case when n.attempts >= n.max_attempts then now() end,
      last_error = 'Procesamiento interrumpido',
      locked_at = null
  where n.status = 'processing' and n.locked_at < now() - interval '10 minutes';

  -- Avisos de citas ya pasadas: no se envían.
  update public.notifications n
  set status = 'failed', failed_at = now(), last_error = 'La cita ya ha pasado'
  where n.status = 'pending' and (n.payload ->> 'starts_at')::timestamptz <= now();

  return query
  update public.notifications n
  set status = 'processing', locked_at = now(), attempts = n.attempts + 1
  where n.id in (
    select q.id from public.notifications q
    where q.status = 'pending' and q.next_attempt_at <= now() and q.channel = 'email'
    order by q.next_attempt_at
    limit least(greatest(p_batch_size, 1), 100)
    for update skip locked
  )
  returning n.*;
end;
$$;

revoke all on function public.claim_pending_notifications(integer) from public, anon, authenticated;
grant execute on function public.claim_pending_notifications(integer) to service_role;

-- Los avisos pendientes de SMS pasan a email si el cliente lo tiene.
update public.notifications n
set channel = 'email', recipient_email = c.email
from public.appointments a
join public.clients c on c.id = a.client_id
where n.appointment_id = a.id and n.status = 'pending' and n.channel = 'sms' and c.email is not null;

update public.notifications n
set status = 'failed', failed_at = now(), last_error = 'El cliente no tiene email'
where n.status = 'pending' and n.channel = 'sms';

-- -----------------------------------------------------------------------------
-- Código de reserva por email
-- -----------------------------------------------------------------------------
drop function public.request_booking_otp(uuid, text, text);
drop function public.create_public_booking(uuid, text, uuid, timestamptz, text, text, text);

-- Límites: 3 códigos por email cada 15 minutos, 10 por IP cada hora, 5 intentos por código.
create function public.request_booking_otp(p_professional_id uuid, p_email text, p_ip_hash text default null)
returns table (otp_id uuid, code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_code  text;
  v_id    uuid;
  v_exp   timestamptz;
begin
  if v_email is null or char_length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'INVALID_EMAIL' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.professionals p
    join public.salons s on s.id = p.salon_id
    where p.id = p_professional_id
      and p.status = 'active'
      and p.accepts_online_booking
      and s.status in ('trial', 'active')
      and private.has_active_license(p.id)
  ) then
    raise exception 'NOT_BOOKABLE' using errcode = 'P0002';
  end if;

  -- Serializa por email para que dos peticiones simultáneas no esquiven el límite.
  perform pg_advisory_xact_lock(hashtextextended('otp:' || v_email, 0));

  if (select count(*) from public.booking_otps o
      where o.email = v_email and o.created_at > now() - interval '15 minutes') >= 3 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = 'P0001';
  end if;
  if p_ip_hash is not null and (select count(*) from public.booking_otps o
      where o.ip_hash = p_ip_hash and o.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = 'P0001';
  end if;

  v_code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint & 2147483647) % 1000000)::text, 6, '0');

  insert into public.booking_otps (professional_id, email, code_hash, ip_hash)
  values (p_professional_id, v_email, extensions.crypt(v_code, extensions.gen_salt('bf', 8)), p_ip_hash)
  returning id, booking_otps.expires_at into v_id, v_exp;

  return query select v_id, v_code, v_exp;
end;
$$;

-- Verifica el código y crea la reserva en una sola transacción.
-- Máximo 3 citas futuras por profesional con el mismo email o teléfono.
create function public.create_public_booking(
  p_otp_id     uuid,
  p_code       text,
  p_service_id uuid,
  p_starts_at  timestamptz,
  p_full_name  text,
  p_phone      text,
  p_notes      text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_otp       public.booking_otps%rowtype;
  v_service   public.services%rowtype;
  v_pro       public.professionals%rowtype;
  v_tz        text;
  v_ends_at   timestamptz;
  v_client_id uuid;
  v_id        uuid;
begin
  select * into v_otp from public.booking_otps o where o.id = p_otp_id for update;
  if v_otp.id is null or v_otp.email is null or v_otp.consumed_at is not null or v_otp.expires_at < now() then
    raise exception 'OTP_EXPIRED' using errcode = 'P0001';
  end if;
  if v_otp.attempts >= 5 then
    raise exception 'OTP_LOCKED' using errcode = 'P0001';
  end if;
  if p_code is null or extensions.crypt(p_code, v_otp.code_hash) <> v_otp.code_hash then
    -- Código incorrecto: se devuelve null en vez de un error para que el intento quede guardado.
    update public.booking_otps set attempts = attempts + 1 where id = v_otp.id;
    return null;
  end if;

  select * into v_service from public.services s
  where s.id = p_service_id and s.is_active and s.is_public and s.professional_id = v_otp.professional_id;
  select * into v_pro from public.professionals p where p.id = v_otp.professional_id;
  select s.timezone into v_tz from public.salons s
  where s.id = v_pro.salon_id and s.status in ('trial', 'active');

  if v_service.id is null or v_tz is null or v_pro.status <> 'active' or not v_pro.accepts_online_booking
     or not private.has_active_license(v_pro.id) then
    raise exception 'NOT_BOOKABLE' using errcode = 'P0002';
  end if;

  if p_full_name is null or char_length(trim(p_full_name)) not between 2 and 120 then
    raise exception 'INVALID_NAME' using errcode = '22023';
  end if;
  if p_phone is null or p_phone !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'INVALID_PHONE' using errcode = '22023';
  end if;
  if p_starts_at is null or extract(epoch from p_starts_at)::bigint % 300 <> 0
     or p_starts_at < now() + make_interval(mins => v_pro.min_notice_minutes)
     or p_starts_at >= now() + make_interval(days => v_pro.booking_horizon_days) then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_service.duration_minutes);

  perform private.lock_professional(v_pro.id);

  if (
    select count(*)
    from public.appointments a
    join public.clients c on c.id = a.client_id
    where a.professional_id = v_pro.id
      and a.status in ('pending', 'confirmed')
      and a.starts_at > now()
      and (a.contact_email = v_otp.email or c.phone = p_phone)
  ) >= 3 then
    raise exception 'TOO_MANY_BOOKINGS' using errcode = 'P0001';
  end if;

  begin
    perform private.assert_slot_free(
      v_pro.id, p_starts_at, v_ends_at, make_interval(mins => v_service.buffer_after_minutes), v_tz, false
    );
  exception when others then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end;

  -- El teléfono no está verificado: se reutiliza la ficha, pero sin cambiar sus datos.
  select c.id into v_client_id from public.clients c
  where c.professional_id = v_pro.id and c.phone = p_phone
  order by c.archived_at nulls first, c.created_at desc
  limit 1;

  if v_client_id is null then
    insert into public.clients (salon_id, professional_id, full_name, phone, email, email_verified_at)
    values (v_pro.salon_id, v_pro.id, trim(p_full_name), p_phone, v_otp.email, now())
    returning id into v_client_id;
  else
    update public.clients
    set archived_at = null,
        email_verified_at = case when email = v_otp.email then now() else email_verified_at end
    where id = v_client_id;
  end if;

  begin
    insert into public.appointments
      (salon_id, professional_id, client_id, service_id, starts_at, ends_at, status, source, notes, contact_email)
    values
      (v_pro.salon_id, v_pro.id, v_client_id, v_service.id, p_starts_at, v_ends_at,
       'confirmed', 'public_portal', nullif(left(trim(p_notes), 1000), ''), v_otp.email)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end;

  update public.booking_otps set consumed_at = now() where id = v_otp.id;
  return v_id;
end;
$$;

revoke all on function public.request_booking_otp(uuid, text, text) from public, anon, authenticated;
revoke all on function public.create_public_booking(uuid, text, uuid, timestamptz, text, text, text) from public, anon, authenticated;
grant execute on function public.request_booking_otp(uuid, text, text) to service_role;
grant execute on function public.create_public_booking(uuid, text, uuid, timestamptz, text, text, text) to service_role;
