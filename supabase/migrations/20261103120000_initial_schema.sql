-- =============================================================================
-- VELTUX · Migración inicial (Sprint 0)
--
-- Esquema multi-tenant con aislamiento por Row Level Security.
--   · Tenant  = salon (peluquería / barbería).
--   · Cada profesional autónomo es dueño de su agenda, servicios y clientes.
--   · El propietario gestiona licencias y ve ocupación, nunca datos de clientes
--     de otros profesionales.
--
-- Convenciones:
--   · UUID como PK (gen_random_uuid).
--   · Importes en céntimos (integer) + moneda ISO-4217.
--   · Instantes en timestamptz (UTC); la zona horaria vive en salons.timezone.
--   · Funciones auxiliares de autorización en el esquema `private`
--     (no expuesto por la API REST de Supabase).
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Tipos enumerados
-- -----------------------------------------------------------------------------

create type public.platform_role as enum ('user', 'admin');
create type public.salon_kind as enum ('barberia', 'peluqueria', 'unisex');
create type public.salon_status as enum ('trial', 'active', 'suspended', 'cancelled');
create type public.membership_role as enum ('owner', 'professional');
create type public.membership_status as enum ('invited', 'active', 'disabled');
create type public.professional_status as enum ('invited', 'active', 'inactive');
create type public.schedule_exception_type as enum ('block', 'break', 'day_off', 'extra_availability');
create type public.appointment_status as enum ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
create type public.appointment_source as enum ('professional', 'public_portal', 'reassignment');
create type public.appointment_event_type as enum (
  'created', 'updated', 'confirmed', 'rescheduled', 'cancelled', 'reassigned', 'completed', 'no_show'
);
create type public.actor_kind as enum ('professional', 'owner', 'client', 'system');
create type public.incident_status as enum ('open', 'resolved', 'cancelled');
create type public.change_request_type as enum ('reschedule', 'reassignment');
create type public.change_request_status as enum (
  'pending_target', 'pending_client', 'accepted', 'rejected', 'expired', 'cancelled', 'applied'
);
create type public.notification_channel as enum ('sms', 'email', 'in_app');
create type public.notification_status as enum ('pending', 'processing', 'sent', 'delivered', 'failed');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'paused', 'cancelled');

-- -----------------------------------------------------------------------------
-- Utilidades comunes
-- -----------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles · 1:1 con auth.users
-- -----------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text not null default '' check (char_length(full_name) <= 120),
  phone         text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  avatar_url    text,
  platform_role public.platform_role not null default 'user',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- salons · tenant
-- -----------------------------------------------------------------------------

create table public.salons (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique
               check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$')
               check (slug not in (
                 'admin', 'api', 'app', 'auth', 'login', 'logout', 'registro', 'profesional',
                 'propietario', 'reservar', 'ayuda', 'soporte', 'static', 'www', 'veltux'
               )),
  name         text not null check (char_length(name) between 2 and 120),
  kind         public.salon_kind not null default 'barberia',
  status       public.salon_status not null default 'trial',
  timezone     text not null default 'Europe/Madrid',
  phone        text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  email        text check (email is null or email = lower(email)),
  address_line text,
  city         text,
  postal_code  text,
  country      char(2) not null default 'ES',
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger salons_set_updated_at
  before update on public.salons
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- salon_memberships · rol de cada usuario en cada establecimiento
-- Un propietario que también ejerce tiene dos filas: owner + professional.
-- -----------------------------------------------------------------------------

create table public.salon_memberships (
  id         uuid primary key default gen_random_uuid(),
  salon_id   uuid not null references public.salons (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.membership_role not null,
  status     public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, user_id, role)
);

create index salon_memberships_user_idx on public.salon_memberships (user_id);

create trigger salon_memberships_set_updated_at
  before update on public.salon_memberships
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- professionals · autónomo con agenda dentro de un salón
-- user_id es nullable para permitir invitaciones antes del registro.
-- -----------------------------------------------------------------------------

create table public.professionals (
  id                     uuid primary key default gen_random_uuid(),
  salon_id               uuid not null references public.salons (id) on delete cascade,
  user_id                uuid references public.profiles (id) on delete set null,
  display_name           text not null check (char_length(display_name) between 2 and 80),
  slug                   text not null check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$'),
  bio                    text check (char_length(bio) <= 500),
  avatar_url             text,
  phone                  text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  email                  text check (email is null or email = lower(email)),
  color                  text not null default '#B8FF65' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  status                 public.professional_status not null default 'invited',
  accepts_online_booking boolean not null default true,
  sort_order             integer not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (salon_id, slug),
  unique (id, salon_id)
);

create unique index professionals_salon_user_uidx
  on public.professionals (salon_id, user_id) where user_id is not null;
create index professionals_user_idx on public.professionals (user_id);

create trigger professionals_set_updated_at
  before update on public.professionals
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Funciones de autorización (SECURITY DEFINER → evitan recursión de RLS)
-- -----------------------------------------------------------------------------

create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.platform_role = 'admin'
  );
$$;

create function private.is_salon_member(p_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.salon_memberships m
    where m.salon_id = p_salon_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create function private.is_salon_owner(p_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.salon_memberships m
    where m.salon_id = p_salon_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
      and m.status = 'active'
  );
$$;

-- Fichas de profesional del usuario actual (lectura de su propia información).
create function private.my_professional_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.professionals p
  where p.user_id = (select auth.uid());
$$;

-- Fichas con las que el usuario puede operar (escritura): profesional activo.
create function private.my_active_professional_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.professionals p
  where p.user_id = (select auth.uid()) and p.status = 'active';
$$;

grant execute on all functions in schema private to authenticated, service_role;

-- Un profesional no puede cambiar su propio estado: solo el propietario o la plataforma.
create function private.guard_professional_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.status is distinct from old.status
     and not (private.is_salon_owner(old.salon_id) or private.is_platform_admin()) then
    raise exception 'FORBIDDEN_STATUS_CHANGE' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger professionals_guard_update
  before update on public.professionals
  for each row execute function private.guard_professional_update();

-- -----------------------------------------------------------------------------
-- subscriptions · contrato SaaS del establecimiento (Stripe en Sprint 9)
-- -----------------------------------------------------------------------------

create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  salon_id               uuid not null unique references public.salons (id) on delete cascade,
  plan                   text not null default 'pilot',
  status                 public.subscription_status not null default 'trialing',
  license_quantity       integer not null default 0 check (license_quantity between 0 and 500),
  trial_ends_at          timestamptz,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- license_assignments · historial de licencias (nunca se borra)
-- Licencia activa = revoked_at IS NULL. Máximo una activa por profesional.
-- -----------------------------------------------------------------------------

create table public.license_assignments (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid not null,
  professional_id uuid not null,
  assigned_by     uuid references public.profiles (id) on delete set null,
  assigned_at     timestamptz not null default now(),
  revoked_at      timestamptz,
  revoked_by      uuid references public.profiles (id) on delete set null,
  revoke_reason   text,
  foreign key (professional_id, salon_id)
    references public.professionals (id, salon_id) on delete cascade,
  check (revoked_at is null or revoked_at >= assigned_at)
);

create unique index license_assignments_active_uidx
  on public.license_assignments (professional_id) where revoked_at is null;
create index license_assignments_salon_idx on public.license_assignments (salon_id);

-- Control de límite: se serializa bloqueando la suscripción del salón.
create function private.enforce_license_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quantity integer;
  v_active   integer;
begin
  if new.revoked_at is not null then
    return new;
  end if;

  -- Los triggers BEFORE se ejecutan antes que RLS: se valida el rol aquí también
  -- para no revelar el cupo de licencias a quien no es propietario.
  if (select auth.uid()) is not null and not private.is_salon_owner(new.salon_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select s.license_quantity into v_quantity
  from public.subscriptions s
  where s.salon_id = new.salon_id
    and s.status in ('trialing', 'active')
  for update;

  if v_quantity is null then
    raise exception 'NO_ACTIVE_SUBSCRIPTION' using errcode = 'P0001';
  end if;

  select count(*) into v_active
  from public.license_assignments la
  where la.salon_id = new.salon_id and la.revoked_at is null;

  if v_active >= v_quantity then
    raise exception 'LICENSE_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger license_assignments_enforce_limit
  before insert on public.license_assignments
  for each row execute function private.enforce_license_limit();

create function private.has_active_license(p_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.license_assignments la
    where la.professional_id = p_professional_id and la.revoked_at is null
  );
$$;

grant execute on function private.has_active_license(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- services · catálogo individual de cada profesional
-- -----------------------------------------------------------------------------

create table public.services (
  id                   uuid primary key default gen_random_uuid(),
  salon_id             uuid not null,
  professional_id      uuid not null,
  name                 text not null check (char_length(name) between 2 and 80),
  description          text check (char_length(description) <= 500),
  duration_minutes     integer not null check (duration_minutes between 5 and 600),
  buffer_after_minutes integer not null default 0 check (buffer_after_minutes between 0 and 120),
  price_cents          integer not null check (price_cents >= 0),
  currency             char(3) not null default 'EUR',
  is_active            boolean not null default true,
  is_public            boolean not null default true,
  sort_order           integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  foreign key (professional_id, salon_id)
    references public.professionals (id, salon_id) on delete cascade,
  unique (id, professional_id)
);

create index services_professional_idx on public.services (professional_id);

create trigger services_set_updated_at
  before update on public.services
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- work_schedules · horario semanal recurrente (ISO: 1 = lunes … 7 = domingo)
-- Varias franjas por día permiten jornada partida.
-- -----------------------------------------------------------------------------

create table public.work_schedules (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid not null,
  professional_id uuid not null,
  weekday         smallint not null check (weekday between 1 and 7),
  start_time      time not null,
  end_time        time not null,
  valid_from      date not null default current_date,
  valid_until     date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (professional_id, salon_id)
    references public.professionals (id, salon_id) on delete cascade,
  check (end_time > start_time),
  check (valid_until is null or valid_until >= valid_from)
);

create index work_schedules_professional_idx on public.work_schedules (professional_id, weekday);

create trigger work_schedules_set_updated_at
  before update on public.work_schedules
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- schedule_incidents · imprevistos ("GESTIONAR IMPREVISTO")
-- -----------------------------------------------------------------------------

create table public.schedule_incidents (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid not null,
  professional_id uuid not null,
  incident_date   date not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  reason          text check (char_length(reason) <= 500),
  status          public.incident_status not null default 'open',
  created_by      uuid references public.profiles (id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (professional_id, salon_id)
    references public.professionals (id, salon_id) on delete cascade,
  check (ends_at > starts_at)
);

create index schedule_incidents_professional_idx on public.schedule_incidents (professional_id, incident_date);

create trigger schedule_incidents_set_updated_at
  before update on public.schedule_incidents
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- schedule_exceptions · bloqueos, descansos, días libres, disponibilidad extra
-- -----------------------------------------------------------------------------

create table public.schedule_exceptions (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid not null,
  professional_id uuid not null,
  type            public.schedule_exception_type not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  reason          text check (char_length(reason) <= 300),
  incident_id     uuid references public.schedule_incidents (id) on delete set null,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (professional_id, salon_id)
    references public.professionals (id, salon_id) on delete cascade,
  check (ends_at > starts_at)
);

create index schedule_exceptions_range_idx
  on public.schedule_exceptions using gist (professional_id, tstzrange(starts_at, ends_at, '[)'));

create trigger schedule_exceptions_set_updated_at
  before update on public.schedule_exceptions
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- clients · cartera PRIVADA de cada profesional
-- La misma persona puede existir en varias carteras sin compartir datos.
-- global_client_id queda reservado para una futura identidad global de cliente.
-- -----------------------------------------------------------------------------

create table public.clients (
  id                uuid primary key default gen_random_uuid(),
  salon_id          uuid not null,
  professional_id   uuid not null,
  full_name         text not null check (char_length(full_name) between 1 and 120),
  phone             text not null check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  phone_verified_at timestamptz,
  email             text check (email is null or email = lower(email)),
  notes             text check (char_length(notes) <= 2000),
  marketing_consent boolean not null default false,
  global_client_id  uuid,
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key (professional_id, salon_id)
    references public.professionals (id, salon_id) on delete cascade,
  unique (id, professional_id)
);

create unique index clients_professional_phone_uidx
  on public.clients (professional_id, phone) where archived_at is null;
create index clients_professional_name_idx on public.clients (professional_id, full_name);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- appointments · reservas
-- Integridad: cliente y servicio del MISMO profesional (FK compuestas).
-- Anti-solapamiento: restricción EXCLUDE sobre citas activas del profesional.
-- -----------------------------------------------------------------------------

create table public.appointments (
  id               uuid primary key default gen_random_uuid(),
  salon_id         uuid not null,
  professional_id  uuid not null,
  client_id        uuid not null,
  service_id       uuid not null,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  status           public.appointment_status not null default 'confirmed',
  source           public.appointment_source not null default 'professional',
  service_name     text not null default '',
  price_cents      integer not null default 0 check (price_cents >= 0),
  currency         char(3) not null default 'EUR',
  notes            text check (char_length(notes) <= 1000),
  cancelled_at     timestamptz,
  cancel_reason    text check (char_length(cancel_reason) <= 300),
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (professional_id, salon_id)
    references public.professionals (id, salon_id) on delete restrict,
  foreign key (client_id, professional_id)
    references public.clients (id, professional_id) on delete restrict,
  foreign key (service_id, professional_id)
    references public.services (id, professional_id) on delete restrict,
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '12 hours'),
  check ((status = 'cancelled') = (cancelled_at is not null)),
  constraint appointments_no_overlap exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);

create index appointments_professional_start_idx on public.appointments (professional_id, starts_at);
create index appointments_salon_start_idx on public.appointments (salon_id, starts_at);
create index appointments_client_idx on public.appointments (client_id);

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function private.set_updated_at();

-- Copia nombre/precio del servicio (histórico inmutable) y exige licencia activa.
create function private.prepare_appointment()
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
  end if;

  return new;
end;
$$;

create trigger appointments_prepare
  before insert or update on public.appointments
  for each row execute function private.prepare_appointment();

-- -----------------------------------------------------------------------------
-- appointment_events · bitácora inmutable de cada reserva (rellenada por trigger)
-- -----------------------------------------------------------------------------

create table public.appointment_events (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid not null references public.appointments (id) on delete cascade,
  salon_id        uuid not null references public.salons (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  event_type      public.appointment_event_type not null,
  actor_user_id   uuid references public.profiles (id) on delete set null,
  actor_kind      public.actor_kind not null default 'system',
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index appointment_events_appointment_idx on public.appointment_events (appointment_id, created_at);

create function private.log_appointment_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type    public.appointment_event_type;
  v_payload jsonb := '{}'::jsonb;
  v_actor   uuid  := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    v_type := 'created';
    v_payload := jsonb_build_object('starts_at', new.starts_at, 'ends_at', new.ends_at, 'status', new.status);
  elsif new.status is distinct from old.status and new.status in ('cancelled', 'confirmed', 'completed', 'no_show') then
    v_type := new.status::text::public.appointment_event_type;
    v_payload := jsonb_build_object('from', old.status, 'to', new.status, 'reason', new.cancel_reason);
  elsif new.professional_id is distinct from old.professional_id then
    v_type := 'reassigned';
    v_payload := jsonb_build_object('from', old.professional_id, 'to', new.professional_id);
  elsif new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at then
    v_type := 'rescheduled';
    v_payload := jsonb_build_object(
      'from', jsonb_build_object('starts_at', old.starts_at, 'ends_at', old.ends_at),
      'to',   jsonb_build_object('starts_at', new.starts_at, 'ends_at', new.ends_at)
    );
  else
    v_type := 'updated';
  end if;

  insert into public.appointment_events
    (appointment_id, salon_id, professional_id, event_type, actor_user_id, actor_kind, payload)
  values (
    new.id, new.salon_id, new.professional_id, v_type, v_actor,
    case when v_actor is null then 'system'::public.actor_kind else 'professional'::public.actor_kind end,
    v_payload
  );
  return null;
end;
$$;

create trigger appointments_log_event
  after insert or update on public.appointments
  for each row execute function private.log_appointment_event();

-- -----------------------------------------------------------------------------
-- appointment_change_requests · reprogramaciones y reasignaciones
-- Flujo de reasignación: solicitante → aceptación receptor → confirmación cliente.
-- -----------------------------------------------------------------------------

create table public.appointment_change_requests (
  id                          uuid primary key default gen_random_uuid(),
  salon_id                    uuid not null references public.salons (id) on delete cascade,
  appointment_id              uuid not null references public.appointments (id) on delete cascade,
  incident_id                 uuid references public.schedule_incidents (id) on delete set null,
  type                        public.change_request_type not null,
  status                      public.change_request_status not null,
  requested_by_professional_id uuid not null references public.professionals (id) on delete cascade,
  target_professional_id      uuid references public.professionals (id) on delete cascade,
  proposed_starts_at          timestamptz not null,
  proposed_ends_at            timestamptz not null,
  proposed_service_id         uuid references public.services (id) on delete set null,
  proposed_price_cents        integer check (proposed_price_cents >= 0),
  message                     text check (char_length(message) <= 500),
  target_responded_at         timestamptz,
  client_responded_at         timestamptz,
  client_token_hash           text unique,
  expires_at                  timestamptz not null default (now() + interval '48 hours'),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  check (proposed_ends_at > proposed_starts_at),
  check (
    (type = 'reassignment' and target_professional_id is not null
       and target_professional_id <> requested_by_professional_id)
    or (type = 'reschedule' and target_professional_id is null)
  )
);

create index change_requests_appointment_idx on public.appointment_change_requests (appointment_id);
create index change_requests_target_idx
  on public.appointment_change_requests (target_professional_id) where status = 'pending_target';
create unique index change_requests_one_open_per_appointment_uidx
  on public.appointment_change_requests (appointment_id)
  where status in ('pending_target', 'pending_client');

create trigger change_requests_set_updated_at
  before update on public.appointment_change_requests
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- notifications · cola persistente (outbox) con reintentos e idempotencia
-- Solo el backend (service_role) inserta y procesa.
-- -----------------------------------------------------------------------------

create table public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  salon_id            uuid not null references public.salons (id) on delete cascade,
  professional_id     uuid references public.professionals (id) on delete set null,
  appointment_id      uuid references public.appointments (id) on delete set null,
  channel             public.notification_channel not null default 'sms',
  status              public.notification_status not null default 'pending',
  template            text not null,
  recipient_phone     text check (recipient_phone is null or recipient_phone ~ '^\+[1-9][0-9]{6,14}$'),
  recipient_user_id   uuid references public.profiles (id) on delete set null,
  payload             jsonb not null default '{}'::jsonb,
  idempotency_key     text not null unique,
  attempts            integer not null default 0 check (attempts >= 0),
  max_attempts        integer not null default 5 check (max_attempts between 1 and 20),
  next_attempt_at     timestamptz not null default now(),
  locked_at           timestamptz,
  provider            text,
  provider_message_id text,
  last_error          text,
  sent_at             timestamptz,
  delivered_at        timestamptz,
  failed_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (recipient_phone is not null or recipient_user_id is not null)
);

create index notifications_queue_idx on public.notifications (next_attempt_at) where status = 'pending';
create index notifications_professional_idx on public.notifications (professional_id, created_at desc);

create trigger notifications_set_updated_at
  before update on public.notifications
  for each row execute function private.set_updated_at();

-- Reclama un lote de notificaciones pendientes de forma concurrente y segura.
create function public.claim_pending_notifications(p_batch_size integer default 20)
returns setof public.notifications
language sql
security definer
set search_path = ''
as $$
  update public.notifications n
  set status = 'processing', locked_at = now(), attempts = n.attempts + 1
  where n.id in (
    select q.id from public.notifications q
    where q.status = 'pending' and q.next_attempt_at <= now()
    order by q.next_attempt_at
    limit least(greatest(p_batch_size, 1), 100)
    for update skip locked
  )
  returning n.*;
$$;

revoke all on function public.claim_pending_notifications(integer) from public, anon, authenticated;
grant execute on function public.claim_pending_notifications(integer) to service_role;

-- -----------------------------------------------------------------------------
-- audit_logs · registro de acciones administrativas
-- -----------------------------------------------------------------------------

create table public.audit_logs (
  id            bigint generated always as identity primary key,
  salon_id      uuid references public.salons (id) on delete set null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  action        text not null,
  entity_type   text not null,
  entity_id     uuid,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index audit_logs_salon_idx on public.audit_logs (salon_id, created_at desc);

create function private.audit_license_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (salon_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    new.salon_id,
    (select auth.uid()),
    case when tg_op = 'INSERT' then 'license.assigned' else 'license.revoked' end,
    'license_assignment',
    new.id,
    jsonb_build_object('professional_id', new.professional_id, 'reason', new.revoke_reason)
  );
  return null;
end;
$$;

create trigger license_assignments_audit
  after insert or update of revoked_at on public.license_assignments
  for each row execute function private.audit_license_change();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.profiles                    enable row level security;
alter table public.salons                      enable row level security;
alter table public.salon_memberships           enable row level security;
alter table public.professionals               enable row level security;
alter table public.subscriptions               enable row level security;
alter table public.license_assignments         enable row level security;
alter table public.services                    enable row level security;
alter table public.work_schedules              enable row level security;
alter table public.schedule_incidents          enable row level security;
alter table public.schedule_exceptions         enable row level security;
alter table public.clients                     enable row level security;
alter table public.appointments                enable row level security;
alter table public.appointment_events          enable row level security;
alter table public.appointment_change_requests enable row level security;
alter table public.notifications               enable row level security;
alter table public.audit_logs                  enable row level security;

-- Los visitantes anónimos nunca leen tablas directamente: solo funciones públicas.
revoke all on all tables in schema public from anon;

-- profiles --------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_platform_admin()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

-- salons ----------------------------------------------------------------------
create policy salons_select_member on public.salons
  for select to authenticated
  using ((select private.is_salon_member(id)) or (select private.is_platform_admin()));

create policy salons_update_owner on public.salons
  for update to authenticated
  using ((select private.is_salon_owner(id)))
  with check ((select private.is_salon_owner(id)));

revoke insert, update, delete on public.salons from authenticated;
grant update (name, kind, timezone, phone, email, address_line, city, postal_code)
  on public.salons to authenticated;

-- salon_memberships -------------------------------------------------------------
create policy memberships_select on public.salon_memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_salon_owner(salon_id))
    or (select private.is_platform_admin())
  );

revoke insert, update, delete on public.salon_memberships from authenticated;

-- professionals -------------------------------------------------------------------
-- Los compañeros del mismo salón ven nombre y estado (necesario para reasignaciones).
create policy professionals_select_salon on public.professionals
  for select to authenticated
  using ((select private.is_salon_member(salon_id)) or (select private.is_platform_admin()));

-- El propietario solo puede vincularse a sí mismo; el resto entra por invitación (Sprint 2).
create policy professionals_insert_owner on public.professionals
  for insert to authenticated
  with check (
    (select private.is_salon_owner(salon_id))
    and (user_id is null or user_id = (select auth.uid()))
  );

create policy professionals_update_self_or_owner on public.professionals
  for update to authenticated
  using (user_id = (select auth.uid()) or (select private.is_salon_owner(salon_id)))
  with check (user_id = (select auth.uid()) or (select private.is_salon_owner(salon_id)));

revoke update, delete on public.professionals from authenticated;
grant update (display_name, slug, bio, avatar_url, phone, email, color, status,
              accepts_online_booking, sort_order)
  on public.professionals to authenticated;

-- subscriptions -----------------------------------------------------------------
create policy subscriptions_select_owner on public.subscriptions
  for select to authenticated
  using ((select private.is_salon_owner(salon_id)) or (select private.is_platform_admin()));

revoke insert, update, delete on public.subscriptions from authenticated;

-- license_assignments -------------------------------------------------------------
create policy licenses_select on public.license_assignments
  for select to authenticated
  using (
    (select private.is_salon_owner(salon_id))
    or professional_id in (select private.my_professional_ids())
    or (select private.is_platform_admin())
  );

create policy licenses_insert_owner on public.license_assignments
  for insert to authenticated
  with check ((select private.is_salon_owner(salon_id)) and revoked_at is null);

create policy licenses_revoke_owner on public.license_assignments
  for update to authenticated
  using ((select private.is_salon_owner(salon_id)))
  with check ((select private.is_salon_owner(salon_id)));

revoke update, delete on public.license_assignments from authenticated;
grant update (revoked_at, revoked_by, revoke_reason) on public.license_assignments to authenticated;

-- services --------------------------------------------------------------------
create policy services_select_salon on public.services
  for select to authenticated
  using ((select private.is_salon_member(salon_id)));

create policy services_insert_own on public.services
  for insert to authenticated
  with check (professional_id in (select private.my_active_professional_ids()));

create policy services_update_own on public.services
  for update to authenticated
  using (professional_id in (select private.my_active_professional_ids()))
  with check (professional_id in (select private.my_active_professional_ids()));

create policy services_delete_own on public.services
  for delete to authenticated
  using (professional_id in (select private.my_active_professional_ids()));

revoke update on public.services from authenticated;
grant update (name, description, duration_minutes, buffer_after_minutes, price_cents,
              currency, is_active, is_public, sort_order)
  on public.services to authenticated;

-- work_schedules -----------------------------------------------------------------
create policy work_schedules_select_salon on public.work_schedules
  for select to authenticated
  using ((select private.is_salon_member(salon_id)));

create policy work_schedules_write_own on public.work_schedules
  for all to authenticated
  using (professional_id in (select private.my_active_professional_ids()))
  with check (professional_id in (select private.my_active_professional_ids()));

-- schedule_exceptions (privadas: el motivo puede ser personal) ----------------------
create policy schedule_exceptions_own on public.schedule_exceptions
  for all to authenticated
  using (professional_id in (select private.my_professional_ids()))
  with check (professional_id in (select private.my_active_professional_ids()));

-- schedule_incidents ------------------------------------------------------------
create policy schedule_incidents_own on public.schedule_incidents
  for all to authenticated
  using (professional_id in (select private.my_professional_ids()))
  with check (professional_id in (select private.my_active_professional_ids()));

-- clients (cartera privada: ni el propietario ni la plataforma la leen) --------------
create policy clients_select_own on public.clients
  for select to authenticated
  using (professional_id in (select private.my_professional_ids()));

create policy clients_insert_own on public.clients
  for insert to authenticated
  with check (professional_id in (select private.my_active_professional_ids()));

create policy clients_update_own on public.clients
  for update to authenticated
  using (professional_id in (select private.my_active_professional_ids()))
  with check (professional_id in (select private.my_active_professional_ids()));

revoke delete on public.clients from authenticated;
revoke update on public.clients from authenticated;
grant update (full_name, phone, email, notes, marketing_consent, archived_at)
  on public.clients to authenticated;

-- appointments ------------------------------------------------------------------
-- El propietario NO lee esta tabla: consulta ocupación con get_salon_occupancy().
create policy appointments_select_own on public.appointments
  for select to authenticated
  using (professional_id in (select private.my_professional_ids()));

create policy appointments_insert_own on public.appointments
  for insert to authenticated
  with check (
    professional_id in (select private.my_active_professional_ids())
    and source = 'professional'
  );

create policy appointments_update_own on public.appointments
  for update to authenticated
  using (professional_id in (select private.my_active_professional_ids()))
  with check (professional_id in (select private.my_active_professional_ids()));

-- No se puede mover una cita a otra agenda ni borrarla: se cancela.
revoke delete on public.appointments from authenticated;
revoke update on public.appointments from authenticated;
grant update (client_id, service_id, starts_at, ends_at, status, notes, cancelled_at, cancel_reason)
  on public.appointments to authenticated;

-- appointment_events (solo lectura; escritura por trigger) -----------------------
create policy appointment_events_select_own on public.appointment_events
  for select to authenticated
  using (professional_id in (select private.my_professional_ids()));

revoke insert, update, delete on public.appointment_events from authenticated;

-- appointment_change_requests ---------------------------------------------------
create policy change_requests_select_parties on public.appointment_change_requests
  for select to authenticated
  using (
    requested_by_professional_id in (select private.my_professional_ids())
    or target_professional_id in (select private.my_professional_ids())
  );

create policy change_requests_insert_requester on public.appointment_change_requests
  for insert to authenticated
  with check (
    requested_by_professional_id in (select private.my_active_professional_ids())
    and status = 'pending_target'
    and exists (
      select 1 from public.appointments a
      where a.id = appointment_id
        and a.professional_id = requested_by_professional_id
    )
  );

-- Las transiciones de estado se harán con funciones transaccionales (Sprint 6).
revoke update, delete on public.appointment_change_requests from authenticated;

-- notifications -------------------------------------------------------------------
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (
    recipient_user_id = (select auth.uid())
    or professional_id in (select private.my_professional_ids())
  );

revoke insert, update, delete on public.notifications from authenticated;

-- audit_logs ----------------------------------------------------------------------
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      (select private.is_salon_owner(salon_id))
      and entity_type in ('salon', 'professional', 'license_assignment', 'subscription')
    )
  );

revoke insert, update, delete on public.audit_logs from authenticated;

-- =============================================================================
-- FUNCIONES DE ACCESO CONTROLADO
-- =============================================================================

-- Portal público: datos mínimos del salón, profesionales con licencia y servicios.
-- Nunca devuelve clientes, citas, teléfonos de profesionales ni notas.
create function public.get_public_salon(p_slug text)
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

revoke all on function public.get_public_salon(text) from public;
grant execute on function public.get_public_salon(text) to anon, authenticated;

-- Ocupación agregada para el propietario: franjas ocupadas sin datos de cliente.
create function public.get_salon_occupancy(p_salon_id uuid, p_from timestamptz, p_to timestamptz)
returns table (professional_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.is_salon_owner(p_salon_id) or private.is_platform_admin()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_to <= p_from or p_to - p_from > interval '31 days' then
    raise exception 'INVALID_RANGE' using errcode = '22023';
  end if;

  return query
    select a.professional_id, a.starts_at, a.ends_at
    from public.appointments a
    where a.salon_id = p_salon_id
      and a.status in ('pending', 'confirmed', 'completed')
      and a.starts_at < p_to
      and a.ends_at > p_from
    order by a.starts_at;
end;
$$;

revoke all on function public.get_salon_occupancy(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_salon_occupancy(uuid, timestamptz, timestamptz) to authenticated;
