-- =============================================================================
-- VELTUX · Sprint 5 · Reserva pública con verificación por SMS (OTP)
--
-- Flujo:
--   1. El cliente elige servicio y hueco (get_available_slots, anon).
--   2. El servidor pide un código: request_booking_otp() lo genera, guarda
--      solo su hash y devuelve el código para enviarlo por SMS.
--   3. El cliente escribe el código: create_public_booking() lo verifica y
--      crea la cita en la misma transacción.
-- Las dos funciones solo las ejecuta service_role (el servidor de la app):
-- nunca se exponen al navegador. Los límites de abuso viven en PostgreSQL.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Ajustes de reserva por profesional
-- -----------------------------------------------------------------------------
alter table public.professionals
  add column min_notice_minutes integer not null default 120
    check (min_notice_minutes between 0 and 10080),
  add column booking_horizon_days integer not null default 60
    check (booking_horizon_days between 1 and 365);

grant update (min_notice_minutes, booking_horizon_days) on public.professionals to authenticated;

-- -----------------------------------------------------------------------------
-- get_available_slots: el público respeta antelación mínima y horizonte
-- -----------------------------------------------------------------------------
create or replace function public.get_available_slots(
  p_service_id   uuid,
  p_from         date,
  p_to           date,
  p_step_minutes integer default 15
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_service  public.services%rowtype;
  v_tz       text;
  v_own      boolean;
  v_duration interval;
  v_buffer   interval;
  v_step     interval;
  v_start    timestamptz;
  v_end      timestamptz;
  v_busy     tstzmultirange;
  v_earliest timestamptz;
  v_latest   timestamptz;
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 30 then
    raise exception 'INVALID_RANGE' using errcode = '22023';
  end if;
  if p_step_minutes is null or p_step_minutes not in (5, 10, 15, 20, 30, 60) then
    raise exception 'INVALID_STEP' using errcode = '22023';
  end if;

  select * into v_service from public.services s where s.id = p_service_id and s.is_active;
  if v_service.id is null then
    raise exception 'NOT_BOOKABLE' using errcode = 'P0002';
  end if;

  v_own := v_service.professional_id in (select private.my_active_professional_ids());

  select s.timezone,
         case when v_own then now() else now() + make_interval(mins => p.min_notice_minutes) end,
         case when v_own then 'infinity'::timestamptz else now() + make_interval(days => p.booking_horizon_days) end
    into v_tz, v_earliest, v_latest
  from public.professionals p
  join public.salons s on s.id = p.salon_id
  where p.id = v_service.professional_id
    and p.status = 'active'
    and s.status in ('trial', 'active')
    and private.has_active_license(p.id)
    and (v_own or (p.accepts_online_booking and v_service.is_public));
  if v_tz is null then
    raise exception 'NOT_BOOKABLE' using errcode = 'P0002';
  end if;

  v_duration := make_interval(mins => v_service.duration_minutes);
  v_buffer   := make_interval(mins => v_service.buffer_after_minutes);
  v_step     := make_interval(mins => p_step_minutes);
  v_start    := p_from::timestamp at time zone v_tz;
  v_end      := (p_to + 1)::timestamp at time zone v_tz;
  v_busy     := private.busy_time(v_service.professional_id, v_start, v_end);

  return query
  select gs, gs + v_duration
  from unnest(private.schedule_time(v_service.professional_id, v_start, v_end, v_tz) - v_busy) as f(r)
  cross join lateral generate_series(lower(f.r), upper(f.r) - v_duration, v_step) as gs
  where gs >= v_earliest
    and gs < v_latest
    and not (v_busy && tstzrange(gs, gs + v_duration + v_buffer, '[)'))
  order by gs;
end;
$$;

-- -----------------------------------------------------------------------------
-- booking_otps · códigos de verificación (solo hash; sin acceso de clientes)
-- -----------------------------------------------------------------------------
create table public.booking_otps (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  phone           text not null check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  code_hash       text not null,
  ip_hash         text,
  attempts        smallint not null default 0,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '10 minutes',
  consumed_at     timestamptz
);

create index booking_otps_phone_idx on public.booking_otps (phone, created_at desc);
create index booking_otps_ip_idx on public.booking_otps (ip_hash, created_at desc);

alter table public.booking_otps enable row level security;
revoke all on public.booking_otps from anon, authenticated;

-- Límites (por ventana deslizante):
--   · 3 códigos por teléfono cada 15 minutos
--   · 10 códigos por IP cada hora
--   · 5 intentos por código; caduca a los 10 minutos
create function public.request_booking_otp(p_professional_id uuid, p_phone text, p_ip_hash text default null)
returns table (otp_id uuid, code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_id   uuid;
  v_exp  timestamptz;
begin
  if p_phone is null or p_phone !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'INVALID_PHONE' using errcode = '22023';
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

  -- Serializa por teléfono para que dos peticiones simultáneas no esquiven el límite.
  perform pg_advisory_xact_lock(hashtextextended('otp:' || p_phone, 0));

  if (select count(*) from public.booking_otps o
      where o.phone = p_phone and o.created_at > now() - interval '15 minutes') >= 3 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = 'P0001';
  end if;
  if p_ip_hash is not null and (select count(*) from public.booking_otps o
      where o.ip_hash = p_ip_hash and o.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = 'P0001';
  end if;

  -- 6 dígitos con aleatoriedad criptográfica.
  v_code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint & 2147483647) % 1000000)::text, 6, '0');

  insert into public.booking_otps (professional_id, phone, code_hash, ip_hash)
  values (p_professional_id, p_phone, extensions.crypt(v_code, extensions.gen_salt('bf', 8)), p_ip_hash)
  returning id, booking_otps.expires_at into v_id, v_exp;

  return query select v_id, v_code, v_exp;
end;
$$;

-- Verifica el código y crea la reserva en una sola transacción.
create function public.create_public_booking(
  p_otp_id     uuid,
  p_code       text,
  p_service_id uuid,
  p_starts_at  timestamptz,
  p_full_name  text,
  p_email      text default null,
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
  if v_otp.id is null or v_otp.consumed_at is not null or v_otp.expires_at < now() then
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
  if p_starts_at is null or extract(epoch from p_starts_at)::bigint % 300 <> 0
     or p_starts_at < now() + make_interval(mins => v_pro.min_notice_minutes)
     or p_starts_at >= now() + make_interval(days => v_pro.booking_horizon_days) then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_service.duration_minutes);

  perform private.lock_professional(v_pro.id);
  begin
    perform private.assert_slot_free(
      v_pro.id, p_starts_at, v_ends_at, make_interval(mins => v_service.buffer_after_minutes), v_tz, false
    );
  exception when others then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end;

  -- Cliente en la cartera del profesional: se reutiliza por teléfono (también si estaba archivado).
  select c.id into v_client_id from public.clients c
  where c.professional_id = v_pro.id and c.phone = v_otp.phone
  order by c.archived_at nulls first, c.created_at desc
  limit 1;

  if v_client_id is null then
    insert into public.clients (salon_id, professional_id, full_name, phone, email, phone_verified_at)
    values (v_pro.salon_id, v_pro.id, trim(p_full_name), v_otp.phone,
            nullif(lower(trim(p_email)), ''), now())
    returning id into v_client_id;
  else
    update public.clients
    set phone_verified_at = now(),
        archived_at = null,
        email = coalesce(email, nullif(lower(trim(p_email)), ''))
    where id = v_client_id;
  end if;

  begin
    insert into public.appointments
      (salon_id, professional_id, client_id, service_id, starts_at, ends_at, status, source, notes)
    values
      (v_pro.salon_id, v_pro.id, v_client_id, v_service.id, p_starts_at, v_ends_at,
       'confirmed', 'public_portal', nullif(left(trim(p_notes), 1000), ''))
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

-- -----------------------------------------------------------------------------
-- Página pública: añade los ajustes de reserva de cada profesional
-- -----------------------------------------------------------------------------
create or replace function public.get_public_salon(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'slug', s.slug,
    'name', s.name,
    'kind', s.kind,
    'city', s.city,
    'address_line', s.address_line,
    'timezone', s.timezone,
    'professionals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'slug', p.slug,
        'display_name', p.display_name,
        'bio', p.bio,
        'avatar_url', p.avatar_url,
        'color', p.color,
        'min_notice_minutes', p.min_notice_minutes,
        'booking_horizon_days', p.booking_horizon_days,
        'services', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', sv.id,
            'name', sv.name,
            'description', sv.description,
            'duration_minutes', sv.duration_minutes,
            'price_cents', sv.price_cents,
            'currency', sv.currency
          ) order by sv.sort_order, sv.name)
          from public.services sv
          where sv.professional_id = p.id and sv.is_active and sv.is_public
        ), '[]'::jsonb)
      ) order by p.sort_order, p.display_name)
      from public.professionals p
      where p.salon_id = s.id
        and p.status = 'active'
        and p.accepts_online_booking
        and private.has_active_license(p.id)
    ), '[]'::jsonb)
  )
  from public.salons s
  where s.slug = lower(p_slug)
    and s.status in ('trial', 'active');
$$;
