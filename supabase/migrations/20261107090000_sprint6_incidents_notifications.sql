-- =============================================================================
-- VELTUX · Sprint 6 · Imprevistos y notificaciones
--
-- Notificaciones: un trigger sobre appointments y las funciones de cambio
-- encolan los SMS en `notifications` (idempotency_key). Solo un proveedor real
-- los marca como enviados: sin proveedor permanecen en estado pendiente.
--
-- Reasignación: solicitud del profesional → aceptación del receptor (elige su
-- servicio y se comprueba su disponibilidad) → confirmación del cliente →
-- la cita pasa a la otra agenda. El receptor no ve los datos del cliente hasta
-- que este confirma, y solo recibe su nombre y teléfono.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Rutas de la aplicación que no pueden usarse como dirección de un establecimiento
-- -----------------------------------------------------------------------------
alter table public.salons
  add constraint salons_slug_not_route
    check (slug not in ('panel', 'cuenta', 'recuperar', 'sin-acceso', 'cita'));

-- -----------------------------------------------------------------------------
-- Encolado de SMS al cliente de una cita
-- -----------------------------------------------------------------------------
create function private.enqueue_client_sms(
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
    (salon_id, professional_id, appointment_id, template, recipient_phone, payload, idempotency_key, next_attempt_at)
  select a.salon_id, a.professional_id, a.id, p_template, c.phone,
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
  on conflict (idempotency_key) do nothing;
$$;

-- Propuestas abiertas de una cita que ya no tienen sentido: se anulan sin avisar.
create function private.cancel_open_requests(p_appointment_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  with cancelled as (
    update public.appointment_change_requests r
    set status = 'cancelled'
    where r.appointment_id = p_appointment_id and r.status in ('pending_target', 'pending_client')
    returning r.id
  )
  delete from public.notifications n
  where n.status = 'pending'
    and n.idempotency_key in (select 'req:' || c.id::text || ':proposal' from cancelled c);
$$;

create function private.notify_appointment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_future boolean := new.starts_at > now();
  v_epoch  text    := extract(epoch from new.starts_at)::bigint::text;
begin
  if tg_op = 'UPDATE' and (
    (new.status = 'cancelled' and old.status <> 'cancelled')
    or new.starts_at is distinct from old.starts_at
    or new.professional_id is distinct from old.professional_id
  ) then
    delete from public.notifications n
    where n.appointment_id = new.id and n.template = 'appointment.reminder' and n.status = 'pending';
    perform private.cancel_open_requests(new.id);
  end if;

  if not v_future or new.status = 'no_show' or new.status = 'completed' then
    return null;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'cancelled' then
      return null;
    end if;
    perform private.enqueue_client_sms(new.id, 'appointment.created', 'appt:' || new.id || ':created');
  elsif new.status = 'cancelled' then
    if old.status <> 'cancelled' then
      perform private.enqueue_client_sms(new.id, 'appointment.cancelled', 'appt:' || new.id || ':cancelled');
    end if;
    return null;
  elsif new.professional_id is distinct from old.professional_id then
    perform private.enqueue_client_sms(new.id, 'appointment.reassigned', 'appt:' || new.id || ':reassigned:' || new.professional_id || ':' || v_epoch);
  elsif new.starts_at is distinct from old.starts_at then
    perform private.enqueue_client_sms(new.id, 'appointment.rescheduled', 'appt:' || new.id || ':rescheduled:' || v_epoch);
  else
    return null;
  end if;

  -- Recordatorio 24 h antes, solo si queda margen.
  if new.starts_at - interval '24 hours' > now() + interval '1 hour' then
    perform private.enqueue_client_sms(
      new.id, 'appointment.reminder', 'appt:' || new.id || ':reminder:' || v_epoch,
      '{}'::jsonb, new.starts_at - interval '24 hours'
    );
  end if;
  return null;
end;
$$;

create trigger appointments_notify
  after insert or update of status, starts_at, ends_at, professional_id on public.appointments
  for each row execute function private.notify_appointment_change();

-- -----------------------------------------------------------------------------
-- Procesamiento de la cola: reintentos con espera exponencial
-- -----------------------------------------------------------------------------
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

  -- Avisos de citas ya pasadas (p. ej. acumulados antes de conectar el proveedor): no se envían.
  update public.notifications n
  set status = 'failed', failed_at = now(), last_error = 'La cita ya ha pasado'
  where n.status = 'pending' and (n.payload ->> 'starts_at')::timestamptz <= now();

  return query
  update public.notifications n
  set status = 'processing', locked_at = now(), attempts = n.attempts + 1
  where n.id in (
    select q.id from public.notifications q
    where q.status = 'pending' and q.next_attempt_at <= now() and q.channel = 'sms'
    order by q.next_attempt_at
    limit least(greatest(p_batch_size, 1), 100)
    for update skip locked
  )
  returning n.*;
end;
$$;

revoke all on function public.claim_pending_notifications(integer) from public, anon, authenticated;
grant execute on function public.claim_pending_notifications(integer) to service_role;

create function public.record_notification_result(
  p_id         uuid,
  p_ok         boolean,
  p_provider   text,
  p_message_id text default null,
  p_error      text default null
)
returns public.notification_status
language sql
security definer
set search_path = ''
as $$
  update public.notifications n
  set status = case
        when p_ok then 'sent'::public.notification_status
        when n.attempts >= n.max_attempts then 'failed'::public.notification_status
        else 'pending'::public.notification_status
      end,
      sent_at = case when p_ok then now() end,
      failed_at = case when not p_ok and n.attempts >= n.max_attempts then now() end,
      next_attempt_at = case when p_ok then n.next_attempt_at else now() + make_interval(mins => power(2, n.attempts)::integer) end,
      provider = p_provider,
      provider_message_id = p_message_id,
      last_error = case when p_ok then null else left(p_error, 500) end,
      locked_at = null
  where n.id = p_id and n.status = 'processing'
  returning n.status;
$$;

-- El proveedor confirma la entrega (webhook). Solo avanza desde "enviada".
create function public.record_notification_delivered(p_provider text, p_message_id text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with updated as (
    update public.notifications n
    set status = 'delivered', delivered_at = now()
    where n.provider = p_provider and n.provider_message_id = p_message_id and n.status = 'sent'
    returning 1
  )
  select exists (select 1 from updated);
$$;

revoke all on function public.record_notification_result(uuid, boolean, text, text, text) from public, anon, authenticated;
revoke all on function public.record_notification_delivered(text, text) from public, anon, authenticated;
grant execute on function public.record_notification_result(uuid, boolean, text, text, text) to service_role;
grant execute on function public.record_notification_delivered(text, text) to service_role;

-- -----------------------------------------------------------------------------
-- Imprevistos
-- -----------------------------------------------------------------------------
create unique index schedule_incidents_one_open_per_day_uidx
  on public.schedule_incidents (professional_id, incident_date) where status = 'open';

-- Contexto de la ficha activa del usuario para una cita o una jornada.
create function private.open_incident(p_professional_id uuid, p_date date, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_salon uuid;
  v_tz    text;
begin
  select i.id into v_id from public.schedule_incidents i
  where i.professional_id = p_professional_id and i.incident_date = p_date and i.status = 'open';
  if v_id is not null then
    return v_id;
  end if;

  select p.salon_id, s.timezone into v_salon, v_tz
  from public.professionals p join public.salons s on s.id = p.salon_id
  where p.id = p_professional_id;

  insert into public.schedule_incidents (salon_id, professional_id, incident_date, starts_at, ends_at, reason, created_by)
  values (v_salon, p_professional_id, p_date,
          p_date::timestamp at time zone v_tz, (p_date + 1)::timestamp at time zone v_tz,
          nullif(left(trim(p_reason), 500), ''), (select auth.uid()))
  returning id into v_id;

  insert into public.audit_logs (salon_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_salon, (select auth.uid()), 'incident.opened', 'incident', v_id, jsonb_build_object('date', p_date));
  return v_id;
end;
$$;

-- Bloquea la jornada: dejan de ofrecerse huecos. Las citas no se tocan.
create function public.block_my_day(p_professional_id uuid, p_date date, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_incident uuid;
  v_salon    uuid;
  v_tz       text;
begin
  select p.salon_id, s.timezone into v_salon, v_tz
  from public.professionals p join public.salons s on s.id = p.salon_id
  where p.id = p_professional_id and p.id in (select private.my_active_professional_ids());
  if v_salon is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_date is null or p_date < (now() at time zone v_tz)::date then
    raise exception 'INVALID_DATE' using errcode = '22023';
  end if;

  v_incident := private.open_incident(p_professional_id, p_date, p_reason);

  if not exists (
    select 1 from public.schedule_exceptions e
    where e.incident_id = v_incident and e.type = 'day_off'
  ) then
    insert into public.schedule_exceptions (salon_id, professional_id, type, starts_at, ends_at, reason, incident_id)
    values (v_salon, p_professional_id, 'day_off',
            p_date::timestamp at time zone v_tz, (p_date + 1)::timestamp at time zone v_tz,
            nullif(left(trim(p_reason), 300), ''), v_incident);
  end if;
  return v_incident;
end;
$$;

-- Cancela citas activas de una jornada: las indicadas o, sin lista, todas.
create function public.cancel_my_day_appointments(
  p_professional_id uuid,
  p_date            date,
  p_ids             uuid[] default null,
  p_reason          text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz    text;
  v_id    uuid;
  v_count integer := 0;
begin
  select s.timezone into v_tz
  from public.professionals p join public.salons s on s.id = p.salon_id
  where p.id = p_professional_id and p.id in (select private.my_active_professional_ids());
  if v_tz is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  perform private.open_incident(p_professional_id, p_date, p_reason);

  for v_id in
    select a.id from public.appointments a
    where a.professional_id = p_professional_id
      and a.status in ('pending', 'confirmed')
      and (a.starts_at at time zone v_tz)::date = p_date
      and (p_ids is null or a.id = any (p_ids))
  loop
    perform public.set_my_appointment_status(v_id, 'cancelled', p_reason);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Propuesta de reprogramación (la decide el cliente)
-- -----------------------------------------------------------------------------
drop policy change_requests_insert_requester on public.appointment_change_requests;
revoke insert on public.appointment_change_requests from authenticated;

create function public.propose_reschedule(p_appointment_id uuid, p_starts_at timestamptz, p_message text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt   public.appointments%rowtype;
  v_buffer interval;
  v_tz     text;
  v_ends   timestamptz;
  v_id     uuid;
begin
  select * into v_appt from public.appointments a
  where a.id = p_appointment_id
    and a.professional_id in (select private.my_active_professional_ids())
  for update;
  if v_appt.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_appt.status not in ('pending', 'confirmed') then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  if p_starts_at is null or p_starts_at <= now() or extract(epoch from p_starts_at)::bigint % 300 <> 0 then
    raise exception 'INVALID_TIME' using errcode = '22023';
  end if;

  select make_interval(mins => sv.buffer_after_minutes) into v_buffer from public.services sv where sv.id = v_appt.service_id;
  select s.timezone into v_tz from public.salons s where s.id = v_appt.salon_id;
  v_ends := p_starts_at + (v_appt.ends_at - v_appt.starts_at);

  perform private.assert_slot_free(v_appt.professional_id, p_starts_at, v_ends, coalesce(v_buffer, interval '0'), v_tz, false, v_appt.id);

  begin
    insert into public.appointment_change_requests
      (salon_id, appointment_id, type, status, requested_by_professional_id, proposed_starts_at, proposed_ends_at, message, expires_at)
    values
      (v_appt.salon_id, v_appt.id, 'reschedule', 'pending_client', v_appt.professional_id, p_starts_at, v_ends,
       nullif(left(trim(p_message), 500), ''), least(now() + interval '48 hours', p_starts_at, v_appt.starts_at))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'REQUEST_ALREADY_OPEN' using errcode = 'P0001';
  end;

  perform private.enqueue_client_sms(
    v_appt.id, 'change.reschedule_proposed', 'req:' || v_id || ':proposal',
    jsonb_build_object('proposed_starts_at', p_starts_at)
  );
  insert into public.audit_logs (salon_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_appt.salon_id, (select auth.uid()), 'change.proposed', 'change_request', v_id, jsonb_build_object('type', 'reschedule'));
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Reasignación: solicitud → receptor → cliente
-- -----------------------------------------------------------------------------
create function public.request_reassignment(p_appointment_id uuid, p_target_professional_id uuid, p_message text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments%rowtype;
  v_id   uuid;
begin
  select * into v_appt from public.appointments a
  where a.id = p_appointment_id
    and a.professional_id in (select private.my_active_professional_ids())
  for update;
  if v_appt.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_appt.status not in ('pending', 'confirmed') or v_appt.starts_at <= now() then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  if p_target_professional_id = v_appt.professional_id or not exists (
    select 1 from public.professionals p
    where p.id = p_target_professional_id and p.salon_id = v_appt.salon_id and p.status = 'active'
      and private.has_active_license(p.id)
  ) then
    raise exception 'TARGET_UNAVAILABLE' using errcode = 'P0001';
  end if;

  begin
    insert into public.appointment_change_requests
      (salon_id, appointment_id, type, status, requested_by_professional_id, target_professional_id,
       proposed_starts_at, proposed_ends_at, message, expires_at)
    values
      (v_appt.salon_id, v_appt.id, 'reassignment', 'pending_target', v_appt.professional_id, p_target_professional_id,
       v_appt.starts_at, v_appt.ends_at, nullif(left(trim(p_message), 500), ''),
       least(now() + interval '48 hours', v_appt.starts_at))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'REQUEST_ALREADY_OPEN' using errcode = 'P0001';
  end;

  insert into public.audit_logs (salon_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_appt.salon_id, (select auth.uid()), 'change.proposed', 'change_request', v_id, jsonb_build_object('type', 'reassignment'));
  return v_id;
end;
$$;

-- Lo que el receptor necesita para decidir: nunca datos del cliente.
create function public.my_incoming_reassignments()
returns table (
  request_id     uuid,
  starts_at      timestamptz,
  ends_at        timestamptz,
  service_name   text,
  price_cents    integer,
  currency       char(3),
  requester_name text,
  message        text,
  expires_at     timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, a.starts_at, a.ends_at, a.service_name, a.price_cents, a.currency, p.display_name, r.message, r.expires_at
  from public.appointment_change_requests r
  join public.appointments a on a.id = r.appointment_id
  join public.professionals p on p.id = r.requested_by_professional_id
  where r.status = 'pending_target'
    and r.expires_at > now()
    and r.target_professional_id in (select private.my_active_professional_ids())
  order by a.starts_at;
$$;

create function public.respond_my_reassignment(p_request_id uuid, p_accept boolean, p_service_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req     public.appointment_change_requests%rowtype;
  v_service public.services%rowtype;
  v_tz      text;
  v_ends    timestamptz;
  v_target  text;
begin
  select * into v_req from public.appointment_change_requests r
  where r.id = p_request_id
    and r.target_professional_id in (select private.my_active_professional_ids())
    and r.status = 'pending_target'
  for update;
  if v_req.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_req.expires_at <= now() then
    raise exception 'REQUEST_EXPIRED' using errcode = 'P0001';
  end if;

  if not p_accept then
    update public.appointment_change_requests
    set status = 'rejected', target_responded_at = now() where id = v_req.id;
    return;
  end if;

  select * into v_service from public.services s
  where s.id = p_service_id and s.is_active and s.professional_id = v_req.target_professional_id;
  if v_service.id is null then
    raise exception 'SERVICE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select s.timezone into v_tz from public.salons s where s.id = v_req.salon_id;
  v_ends := v_req.proposed_starts_at + make_interval(mins => v_service.duration_minutes);

  perform private.lock_professional(v_req.target_professional_id);
  perform private.assert_slot_free(
    v_req.target_professional_id, v_req.proposed_starts_at, v_ends,
    make_interval(mins => v_service.buffer_after_minutes), v_tz, false
  );

  update public.appointment_change_requests
  set status = 'pending_client',
      target_responded_at = now(),
      proposed_ends_at = v_ends,
      proposed_service_id = v_service.id,
      proposed_price_cents = v_service.price_cents
  where id = v_req.id;

  select p.display_name into v_target from public.professionals p where p.id = v_req.target_professional_id;
  perform private.enqueue_client_sms(
    v_req.appointment_id, 'change.reassignment_proposed', 'req:' || v_req.id || ':proposal',
    jsonb_build_object(
      'proposed_starts_at', v_req.proposed_starts_at,
      'target_name', v_target,
      'proposed_service_name', v_service.name,
      'proposed_price_cents', v_service.price_cents,
      'currency', v_service.currency
    )
  );
end;
$$;

create function public.cancel_my_change_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment uuid;
begin
  select r.appointment_id into v_appointment from public.appointment_change_requests r
  where r.id = p_request_id
    and r.requested_by_professional_id in (select private.my_active_professional_ids())
    and r.status in ('pending_target', 'pending_client');
  if v_appointment is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  perform private.cancel_open_requests(v_appointment);
end;
$$;

-- -----------------------------------------------------------------------------
-- Acciones del cliente (enlace firmado; solo las ejecuta el servidor)
-- -----------------------------------------------------------------------------
create function public.get_appointment_for_client(p_appointment_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'starts_at', a.starts_at,
    'ends_at', a.ends_at,
    'status', a.status,
    'service_name', a.service_name,
    'price_cents', a.price_cents,
    'currency', a.currency,
    'salon_name', s.name,
    'salon_phone', s.phone,
    'salon_address', concat_ws(', ', s.address_line, s.city),
    'professional_name', p.display_name,
    'timezone', s.timezone,
    'proposal', (
      select jsonb_build_object(
        'type', r.type,
        'starts_at', r.proposed_starts_at,
        'ends_at', r.proposed_ends_at,
        'expires_at', r.expires_at,
        'message', r.message,
        'target_name', t.display_name,
        'service_name', sv.name,
        'price_cents', r.proposed_price_cents
      )
      from public.appointment_change_requests r
      left join public.professionals t on t.id = r.target_professional_id
      left join public.services sv on sv.id = r.proposed_service_id
      where r.appointment_id = a.id and r.status = 'pending_client' and r.expires_at > now()
    )
  )
  from public.appointments a
  join public.salons s on s.id = a.salon_id
  join public.professionals p on p.id = a.professional_id
  where a.id = p_appointment_id;
$$;

create function public.respond_change_request_as_client(p_appointment_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req     public.appointment_change_requests%rowtype;
  v_appt    public.appointments%rowtype;
  v_service public.services%rowtype;
  v_phone   text;
  v_name    text;
  v_client  uuid;
  v_tz      text;
  v_buffer  interval;
  v_pro     uuid;
begin
  select * into v_req from public.appointment_change_requests r
  where r.appointment_id = p_appointment_id and r.status = 'pending_client'
  for update;
  if v_req.id is null then
    raise exception 'NO_OPEN_REQUEST' using errcode = 'P0002';
  end if;
  if v_req.expires_at <= now() then
    update public.appointment_change_requests set status = 'expired' where id = v_req.id;
    return 'expired';
  end if;

  if not p_accept then
    update public.appointment_change_requests
    set status = 'rejected', client_responded_at = now() where id = v_req.id;
    insert into public.audit_logs (salon_id, action, entity_type, entity_id, metadata)
    values (v_req.salon_id, 'change.rejected_by_client', 'change_request', v_req.id, jsonb_build_object('type', v_req.type));
    return 'rejected';
  end if;

  select * into v_appt from public.appointments a where a.id = p_appointment_id for update;
  if v_appt.status not in ('pending', 'confirmed') then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  v_pro := coalesce(v_req.target_professional_id, v_appt.professional_id);
  select s.timezone into v_tz from public.salons s where s.id = v_appt.salon_id;

  if v_req.type = 'reassignment' then
    select * into v_service from public.services s where s.id = v_req.proposed_service_id and s.is_active;
    if v_service.id is null then
      raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
    end if;
    v_buffer := make_interval(mins => v_service.buffer_after_minutes);
  else
    select make_interval(mins => sv.buffer_after_minutes) into v_buffer from public.services sv where sv.id = v_appt.service_id;
  end if;

  -- Antes de mover la cita: el trigger anula solo las propuestas aún abiertas.
  update public.appointment_change_requests
  set status = 'applied', client_responded_at = now() where id = v_req.id;

  perform private.lock_professional(v_pro);
  begin
    perform private.assert_slot_free(
      v_pro, v_req.proposed_starts_at, v_req.proposed_ends_at, coalesce(v_buffer, interval '0'), v_tz, false,
      case when v_req.type = 'reschedule' then v_appt.id end
    );

    if v_req.type = 'reassignment' then
      -- Al confirmar, el receptor recibe solo el nombre y el teléfono del cliente.
      select c.phone, c.full_name into v_phone, v_name from public.clients c where c.id = v_appt.client_id;
      select c.id into v_client from public.clients c
      where c.professional_id = v_pro and c.phone = v_phone
      order by c.archived_at nulls first, c.created_at desc
      limit 1;
      if v_client is null then
        insert into public.clients (salon_id, professional_id, full_name, phone, phone_verified_at)
        select v_appt.salon_id, v_pro, v_name, v_phone, c.phone_verified_at
        from public.clients c where c.id = v_appt.client_id
        returning id into v_client;
      else
        update public.clients set archived_at = null where id = v_client;
      end if;

      update public.appointments
      set professional_id = v_pro,
          client_id = v_client,
          service_id = v_service.id,
          starts_at = v_req.proposed_starts_at,
          ends_at = v_req.proposed_ends_at
      where id = v_appt.id;
    else
      update public.appointments
      set starts_at = v_req.proposed_starts_at, ends_at = v_req.proposed_ends_at
      where id = v_appt.id;
    end if;
  exception
    when exclusion_violation then
      raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
    when sqlstate 'P0001' then
      raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end;

  update public.appointment_events e
  set actor_kind = 'client'
  where e.appointment_id = v_appt.id and e.created_at = now();

  insert into public.audit_logs (salon_id, action, entity_type, entity_id, metadata)
  values (v_req.salon_id, 'change.applied', 'change_request', v_req.id, jsonb_build_object('type', v_req.type));
  return 'applied';
end;
$$;

create function public.cancel_appointment_as_client(p_appointment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.appointments a
  set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Cancelada por el cliente'
  where a.id = p_appointment_id and a.status in ('pending', 'confirmed') and a.starts_at > now();
  if not found then
    return false;
  end if;

  update public.appointment_events e
  set actor_kind = 'client'
  where e.appointment_id = p_appointment_id and e.created_at = now();
  return true;
end;
$$;

revoke all on function public.block_my_day(uuid, date, text) from public, anon;
revoke all on function public.cancel_my_day_appointments(uuid, date, uuid[], text) from public, anon;
revoke all on function public.propose_reschedule(uuid, timestamptz, text) from public, anon;
revoke all on function public.request_reassignment(uuid, uuid, text) from public, anon;
revoke all on function public.my_incoming_reassignments() from public, anon;
revoke all on function public.respond_my_reassignment(uuid, boolean, uuid) from public, anon;
revoke all on function public.cancel_my_change_request(uuid) from public, anon;
grant execute on function public.block_my_day(uuid, date, text) to authenticated;
grant execute on function public.cancel_my_day_appointments(uuid, date, uuid[], text) to authenticated;
grant execute on function public.propose_reschedule(uuid, timestamptz, text) to authenticated;
grant execute on function public.request_reassignment(uuid, uuid, text) to authenticated;
grant execute on function public.my_incoming_reassignments() to authenticated;
grant execute on function public.respond_my_reassignment(uuid, boolean, uuid) to authenticated;
grant execute on function public.cancel_my_change_request(uuid) to authenticated;

revoke all on function public.get_appointment_for_client(uuid) from public, anon, authenticated;
revoke all on function public.respond_change_request_as_client(uuid, boolean) from public, anon, authenticated;
revoke all on function public.cancel_appointment_as_client(uuid) from public, anon, authenticated;
grant execute on function public.get_appointment_for_client(uuid) to service_role;
grant execute on function public.respond_change_request_as_client(uuid, boolean) to service_role;
grant execute on function public.cancel_appointment_as_client(uuid) to service_role;
