-- =============================================================================
-- VELTUX · Sprint 3 · Servicios, horarios y disponibilidad
--
--   · Horario semanal versionado: guardar un horario nuevo cierra el vigente
--     (valid_until = ayer) y abre otro desde hoy, para no reescribir el pasado.
--   · Sin solapes entre franjas del mismo día (restricción EXCLUDE).
--   · Excepciones: días libres, bloqueos, descansos y disponibilidad extra.
--   · get_available_slots(): huecos libres calculados en PostgreSQL a partir
--     de horario + excepciones − citas activas (con el margen del servicio).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- work_schedules: franjas en múltiplos de 5 minutos y sin solapes
-- -----------------------------------------------------------------------------
alter table public.work_schedules
  add constraint work_schedules_five_minute_grid
    check (extract(epoch from start_time)::integer % 300 = 0
           and extract(epoch from end_time)::integer % 300 = 0),
  add constraint work_schedules_no_overlap exclude using gist (
    professional_id with =,
    weekday with =,
    tsrange(date '2000-01-01' + start_time, date '2000-01-01' + end_time, '[)') with &&,
    daterange(valid_from, valid_until, '[]') with &&
  );

-- El horario solo se modifica con replace_my_weekly_schedule() (versionado).
drop policy work_schedules_write_own on public.work_schedules;
revoke insert, update, delete on public.work_schedules from authenticated;

-- Sustituye el horario semanal del profesional a partir de hoy (zona del salón).
-- p_slots: [{"weekday": 1, "start_time": "09:00", "end_time": "14:00"}, …]
create function public.replace_my_weekly_schedule(p_professional_id uuid, p_slots jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_salon_id uuid;
  v_tz       text;
  v_today    date;
  v_count    integer;
begin
  select p.salon_id, s.timezone into v_salon_id, v_tz
  from public.professionals p
  join public.salons s on s.id = p.salon_id
  where p.id = p_professional_id
    and p.user_id = (select auth.uid())
    and p.status = 'active';
  if v_salon_id is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_slots is null or jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) > 28 then
    raise exception 'INVALID_SCHEDULE' using errcode = '22023';
  end if;

  if exists (
    select 1 from rows from (jsonb_to_recordset(p_slots) as (weekday smallint, start_time time, end_time time)) with ordinality as n(weekday, start_time, end_time, ord)
    where n.weekday is null or n.weekday not between 1 and 7
       or n.start_time is null or n.end_time is null or n.end_time <= n.start_time
       or extract(epoch from n.start_time)::integer % 300 <> 0
       or extract(epoch from n.end_time)::integer % 300 <> 0
  ) then
    raise exception 'INVALID_SCHEDULE' using errcode = '22023';
  end if;

  if exists (
    select 1 from rows from (jsonb_to_recordset(p_slots) as (weekday smallint, start_time time, end_time time)) with ordinality as a(weekday, start_time, end_time, ord)
    join rows from (jsonb_to_recordset(p_slots) as (weekday smallint, start_time time, end_time time)) with ordinality as b(weekday, start_time, end_time, ord)
      on a.ord < b.ord and a.weekday = b.weekday
     and a.start_time < b.end_time and b.start_time < a.end_time
  ) then
    raise exception 'SCHEDULE_OVERLAP' using errcode = '23P01';
  end if;

  v_today := (now() at time zone v_tz)::date;

  -- Versiones que aún no habían empezado: se descartan.
  delete from public.work_schedules ws
  where ws.professional_id = p_professional_id and ws.valid_from >= v_today;

  -- Versión vigente: se cierra ayer.
  update public.work_schedules ws
  set valid_until = v_today - 1
  where ws.professional_id = p_professional_id
    and (ws.valid_until is null or ws.valid_until >= v_today);

  insert into public.work_schedules (salon_id, professional_id, weekday, start_time, end_time, valid_from)
  select v_salon_id, p_professional_id, n.weekday, n.start_time, n.end_time, v_today
  from rows from (jsonb_to_recordset(p_slots) as (weekday smallint, start_time time, end_time time)) with ordinality as n(weekday, start_time, end_time, ord);
  get diagnostics v_count = row_count;

  insert into public.audit_logs (salon_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_salon_id, (select auth.uid()), 'schedule.updated', 'professional', p_professional_id,
          jsonb_build_object('slots', v_count, 'valid_from', v_today));

  return v_count;
end;
$$;

revoke all on function public.replace_my_weekly_schedule(uuid, jsonb) from public, anon;
grant execute on function public.replace_my_weekly_schedule(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- schedule_exceptions: duración razonable y autor fijado por el servidor
-- -----------------------------------------------------------------------------
alter table public.schedule_exceptions
  add constraint schedule_exceptions_max_length check (ends_at - starts_at <= interval '92 days');

create function private.prepare_schedule_exception()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce((select auth.uid()), new.created_by);
  else
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

create trigger schedule_exceptions_prepare
  before insert or update on public.schedule_exceptions
  for each row execute function private.prepare_schedule_exception();

-- -----------------------------------------------------------------------------
-- get_available_slots · huecos reservables de un servicio
--
-- Libre = (horario semanal vigente ∪ disponibilidad extra)
--         − (días libres ∪ bloqueos ∪ descansos ∪ citas activas + margen)
-- Un hueco cabe si la duración del servicio está dentro de lo libre y su
-- margen posterior no pisa otra cita. Solo devuelve huecos futuros.
--
-- Acceso:
--   · Público (anon): servicio activo y público de un profesional activo, con
--     licencia, que acepta reservas online, en un salón en prueba o activo.
--   · El propio profesional: cualquiera de sus servicios activos.
-- Nunca devuelve datos de citas ni motivos de las excepciones.
-- -----------------------------------------------------------------------------
create function public.get_available_slots(
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

  return query
  with
  windows as (
    select tstzrange((d.day + ws.start_time) at time zone v_tz,
                     (d.day + ws.end_time) at time zone v_tz, '[)') as r
    from generate_series(p_from, p_to, interval '1 day') as g(ts)
    cross join lateral (select g.ts::date as day) d
    join public.work_schedules ws
      on ws.professional_id = v_service.professional_id
     and ws.weekday = extract(isodow from d.day)
     and ws.valid_from <= d.day
     and (ws.valid_until is null or ws.valid_until >= d.day)
    union all
    select tstzrange(e.starts_at, e.ends_at, '[)') * tstzrange(v_start, v_end, '[)')
    from public.schedule_exceptions e
    where e.professional_id = v_service.professional_id
      and e.type = 'extra_availability'
      and e.starts_at < v_end and e.ends_at > v_start
  ),
  busy as (
    select tstzrange(a.starts_at, a.ends_at + make_interval(mins => coalesce(sv.buffer_after_minutes, 0)), '[)') as r
    from public.appointments a
    left join public.services sv on sv.id = a.service_id
    where a.professional_id = v_service.professional_id
      and a.status in ('pending', 'confirmed')
      and a.starts_at < v_end + interval '12 hours'
      and a.ends_at > v_start - interval '12 hours'
  ),
  blocked as (
    select tstzrange(e.starts_at, e.ends_at, '[)') as r
    from public.schedule_exceptions e
    where e.professional_id = v_service.professional_id
      and e.type in ('block', 'break', 'day_off')
      and e.starts_at < v_end and e.ends_at > v_start
    union all
    select b.r from busy b
  ),
  free as (
    select unnest(
      coalesce((select range_agg(w.r) from windows w), '{}'::tstzmultirange)
      - coalesce((select range_agg(b.r) from blocked b), '{}'::tstzmultirange)
    ) as r
  )
  select gs, gs + v_duration
  from free f
  cross join lateral generate_series(lower(f.r), upper(f.r) - v_duration, v_step) as gs
  where gs >= now()
    and not exists (
      select 1 from busy b where b.r && tstzrange(gs, gs + v_duration + v_buffer, '[)')
    )
  order by gs;
end;
$$;

revoke all on function public.get_available_slots(uuid, date, date, integer) from public;
grant execute on function public.get_available_slots(uuid, date, date, integer) to anon, authenticated;
