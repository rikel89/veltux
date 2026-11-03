-- =============================================================================
-- VELTUX · Sprint 4 · Agenda
--
-- Las citas solo se escriben con funciones transaccionales:
--   · create_my_appointment()     → alta desde la agenda del profesional
--   · reschedule_my_appointment() → mover de hora o de día
--   · set_my_appointment_status() → confirmar, completar, no presentado, cancelar
-- Todas comprueban el horario, las excepciones y el margen del servicio con el
-- mismo cálculo que get_available_slots() y se serializan por profesional.
-- La restricción EXCLUDE sigue siendo la última barrera contra solapes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Cálculo de tiempo compartido
-- -----------------------------------------------------------------------------

-- Tiempo de trabajo en [p_from, p_to): horario vigente ∪ horario extra
-- − días libres, bloqueos y descansos. No descuenta citas.
create function private.schedule_time(p_professional_id uuid, p_from timestamptz, p_to timestamptz, p_tz text)
returns tstzmultirange
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((
      select range_agg(w.r)
      from (
        select tstzrange((d.day + ws.start_time) at time zone p_tz,
                         (d.day + ws.end_time) at time zone p_tz, '[)') as r
        from generate_series((p_from at time zone p_tz)::date, (p_to at time zone p_tz)::date, interval '1 day') as g(ts)
        cross join lateral (select g.ts::date as day) d
        join public.work_schedules ws
          on ws.professional_id = p_professional_id
         and ws.weekday = extract(isodow from d.day)
         and ws.valid_from <= d.day
         and (ws.valid_until is null or ws.valid_until >= d.day)
        union all
        select tstzrange(e.starts_at, e.ends_at, '[)')
        from public.schedule_exceptions e
        where e.professional_id = p_professional_id
          and e.type = 'extra_availability'
          and e.starts_at < p_to and e.ends_at > p_from
      ) w
    ), '{}'::tstzmultirange)
    * tstzmultirange(tstzrange(p_from, p_to, '[)'))
    - coalesce((
      select range_agg(tstzrange(e.starts_at, e.ends_at, '[)'))
      from public.schedule_exceptions e
      where e.professional_id = p_professional_id
        and e.type in ('block', 'break', 'day_off')
        and e.starts_at < p_to and e.ends_at > p_from
    ), '{}'::tstzmultirange);
$$;

-- Citas activas (con el margen de su servicio) que tocan [p_from, p_to).
create function private.busy_time(
  p_professional_id uuid,
  p_from            timestamptz,
  p_to              timestamptz,
  p_exclude_id      uuid default null
)
returns tstzmultirange
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(range_agg(
    tstzrange(a.starts_at, a.ends_at + make_interval(mins => coalesce(sv.buffer_after_minutes, 0)), '[)')
  ), '{}'::tstzmultirange)
  from public.appointments a
  left join public.services sv on sv.id = a.service_id
  where a.professional_id = p_professional_id
    and a.status in ('pending', 'confirmed')
    and a.id is distinct from p_exclude_id
    and a.starts_at < p_to + interval '12 hours'
    and a.ends_at > p_from - interval '12 hours';
$$;

-- Comprueba que [p_starts_at, p_ends_at) cabe en el horario y que ni la cita
-- ni su margen pisan otra. Con p_force se omite el horario (citas fuera de
-- jornada), pero nunca el solape con otra cita.
create function private.assert_slot_free(
  p_professional_id uuid,
  p_starts_at       timestamptz,
  p_ends_at         timestamptz,
  p_buffer          interval,
  p_tz              text,
  p_force           boolean,
  p_exclude_id      uuid default null
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_slot tstzrange := tstzrange(p_starts_at, p_ends_at, '[)');
begin
  if not p_force
     and not private.schedule_time(p_professional_id, p_starts_at, p_ends_at, p_tz) @> v_slot then
    raise exception 'OUTSIDE_SCHEDULE' using errcode = 'P0001';
  end if;

  if private.busy_time(p_professional_id, p_starts_at, p_ends_at + p_buffer, p_exclude_id)
     && tstzrange(p_starts_at, p_ends_at + case when p_force then interval '0' else p_buffer end, '[)') then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- get_available_slots: misma semántica, ahora sobre el cálculo compartido
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

  select s.timezone into v_tz
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
  where gs >= now()
    and not (v_busy && tstzrange(gs, gs + v_duration + v_buffer, '[)'))
  order by gs;
end;
$$;

-- -----------------------------------------------------------------------------
-- Escritura de citas: solo mediante funciones
-- -----------------------------------------------------------------------------
drop policy appointments_insert_own on public.appointments;
revoke insert on public.appointments from authenticated;
revoke update on public.appointments from authenticated;
grant update (notes) on public.appointments to authenticated;

-- Serializa las escrituras de citas de un mismo profesional (bloqueo de transacción).
create function private.lock_professional(p_professional_id uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended('appointments:' || p_professional_id::text, 0));
$$;

create function public.create_my_appointment(
  p_service_id uuid,
  p_client_id  uuid,
  p_starts_at  timestamptz,
  p_notes      text default null,
  p_force      boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service public.services%rowtype;
  v_tz      text;
  v_ends_at timestamptz;
  v_id      uuid;
begin
  select * into v_service
  from public.services s
  where s.id = p_service_id
    and s.is_active
    and s.professional_id in (select private.my_active_professional_ids());
  if v_service.id is null then
    raise exception 'SERVICE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.clients c
    where c.id = p_client_id and c.professional_id = v_service.professional_id and c.archived_at is null
  ) then
    raise exception 'CLIENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_starts_at is null or extract(epoch from p_starts_at)::bigint % 300 <> 0 then
    raise exception 'INVALID_TIME' using errcode = '22023';
  end if;
  if p_starts_at < now() - interval '15 minutes' and not p_force then
    raise exception 'IN_THE_PAST' using errcode = 'P0001';
  end if;

  select s.timezone into v_tz from public.salons s where s.id = v_service.salon_id;
  v_ends_at := p_starts_at + make_interval(mins => v_service.duration_minutes);

  perform private.lock_professional(v_service.professional_id);
  perform private.assert_slot_free(
    v_service.professional_id, p_starts_at, v_ends_at,
    make_interval(mins => v_service.buffer_after_minutes), v_tz, p_force
  );

  begin
    insert into public.appointments
      (salon_id, professional_id, client_id, service_id, starts_at, ends_at, status, source, notes)
    values
      (v_service.salon_id, v_service.professional_id, p_client_id, v_service.id, p_starts_at, v_ends_at,
       'confirmed', 'professional', nullif(trim(p_notes), ''))
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  return v_id;
end;
$$;

create function public.reschedule_my_appointment(
  p_appointment_id uuid,
  p_starts_at      timestamptz,
  p_force          boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt   public.appointments%rowtype;
  v_buffer interval;
  v_tz     text;
  v_ends   timestamptz;
begin
  select * into v_appt
  from public.appointments a
  where a.id = p_appointment_id
    and a.professional_id in (select private.my_active_professional_ids());
  if v_appt.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_appt.status not in ('pending', 'confirmed') then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  if p_starts_at is null or extract(epoch from p_starts_at)::bigint % 300 <> 0 then
    raise exception 'INVALID_TIME' using errcode = '22023';
  end if;
  if p_starts_at < now() - interval '15 minutes' and not p_force then
    raise exception 'IN_THE_PAST' using errcode = 'P0001';
  end if;

  perform private.lock_professional(v_appt.professional_id);
  select * into v_appt from public.appointments a where a.id = p_appointment_id for update;

  select make_interval(mins => sv.buffer_after_minutes) into v_buffer
  from public.services sv where sv.id = v_appt.service_id;
  select s.timezone into v_tz from public.salons s where s.id = v_appt.salon_id;
  -- Conserva la duración original de la cita.
  v_ends := p_starts_at + (v_appt.ends_at - v_appt.starts_at);

  perform private.assert_slot_free(
    v_appt.professional_id, p_starts_at, v_ends, coalesce(v_buffer, interval '0'), v_tz, p_force, v_appt.id
  );

  begin
    update public.appointments set starts_at = p_starts_at, ends_at = v_ends where id = v_appt.id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;
end;
$$;

-- Transiciones permitidas:
--   pending   → confirmed | cancelled | completed* | no_show*
--   confirmed → cancelled | completed* | no_show*
--   completed ↔ no_show, y ambos → confirmed (deshacer)
--   cancelled → (final)
--   * solo cuando la cita ya ha empezado
create function public.set_my_appointment_status(
  p_appointment_id uuid,
  p_status         public.appointment_status,
  p_reason         text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments%rowtype;
begin
  select * into v_appt
  from public.appointments a
  where a.id = p_appointment_id
    and a.professional_id in (select private.my_active_professional_ids())
  for update;
  if v_appt.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_status is null or p_status = v_appt.status then
    return;
  end if;

  if v_appt.status = 'cancelled'
     or p_status = 'pending'
     or (p_status = 'confirmed' and v_appt.status not in ('pending', 'completed', 'no_show'))
     or (p_status = 'cancelled' and v_appt.status not in ('pending', 'confirmed')) then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  if p_status in ('completed', 'no_show') and v_appt.starts_at > now() then
    raise exception 'NOT_STARTED' using errcode = 'P0001';
  end if;

  if p_reason is not null and char_length(p_reason) > 300 then
    raise exception 'INVALID_REASON' using errcode = '22023';
  end if;

  begin
    update public.appointments
    set status        = p_status,
        cancelled_at  = case when p_status = 'cancelled' then now() end,
        cancel_reason = case when p_status = 'cancelled' then nullif(trim(p_reason), '') end
    where id = v_appt.id;
  exception when exclusion_violation then
    -- Deshacer un "completada" cuando el hueco ya lo ocupa otra cita.
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;
end;
$$;

revoke all on function public.create_my_appointment(uuid, uuid, timestamptz, text, boolean) from public, anon;
revoke all on function public.reschedule_my_appointment(uuid, timestamptz, boolean) from public, anon;
revoke all on function public.set_my_appointment_status(uuid, public.appointment_status, text) from public, anon;
grant execute on function public.create_my_appointment(uuid, uuid, timestamptz, text, boolean) to authenticated;
grant execute on function public.reschedule_my_appointment(uuid, timestamptz, boolean) to authenticated;
grant execute on function public.set_my_appointment_status(uuid, public.appointment_status, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Clientes: listado por fecha de alta (los más recientes primero)
-- -----------------------------------------------------------------------------
create index clients_professional_created_idx on public.clients (professional_id, created_at desc);
