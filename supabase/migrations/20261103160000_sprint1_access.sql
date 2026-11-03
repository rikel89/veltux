-- =============================================================================
-- VELTUX · Sprint 1 · Alta de establecimientos y contexto de acceso por rol
--
-- Fase piloto con alta CERRADA: solo un administrador de la plataforma (o el
-- backend con service_role) crea establecimientos. El propietario recibe una
-- invitación de Supabase Auth para fijar su contraseña.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Contexto de acceso del usuario actual: roles y establecimientos.
-- Lo usa la app para enrutar (/panel) y mostrar el selector de áreas.
-- -----------------------------------------------------------------------------
create function public.get_my_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', (select auth.uid()),
    'is_platform_admin', private.is_platform_admin(),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'salon_id', s.id,
        'salon_name', s.name,
        'salon_slug', s.slug,
        'salon_status', s.status,
        'role', m.role
      ) order by s.name, m.role)
      from public.salon_memberships m
      join public.salons s on s.id = m.salon_id
      where m.user_id = (select auth.uid())
        and m.status = 'active'
        and s.status <> 'cancelled'
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_my_access() from public, anon;
grant execute on function public.get_my_access() to authenticated;

-- -----------------------------------------------------------------------------
-- Licencias: el administrador de la plataforma también puede asignarlas
-- (necesario para el alta de establecimientos desde /admin).
-- -----------------------------------------------------------------------------
create or replace function private.enforce_license_limit()
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
  if (select auth.uid()) is not null
     and not (private.is_salon_owner(new.salon_id) or private.is_platform_admin()) then
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

-- -----------------------------------------------------------------------------
-- Alta transaccional de un establecimiento con su propietario.
-- El usuario propietario debe existir en auth.users (invitado previamente).
-- Autorización: administrador de plataforma o backend (service_role / SQL).
-- -----------------------------------------------------------------------------
create function public.create_salon_with_owner(
  p_owner_email       text,
  p_owner_full_name   text,
  p_salon_name        text,
  p_salon_slug        text,
  p_salon_kind        public.salon_kind default 'barberia',
  p_salon_city        text default null,
  p_salon_phone       text default null,
  p_license_quantity  integer default 3,
  p_owner_works       boolean default true,
  p_professional_slug text default null,
  p_trial_days        integer default 90
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor           uuid := (select auth.uid());
  v_owner_id        uuid;
  v_salon_id        uuid;
  v_professional_id uuid;
begin
  -- anon no tiene EXECUTE; un usuario autenticado debe ser administrador.
  if v_actor is not null and not private.is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select u.id into v_owner_id from auth.users u where lower(u.email) = lower(trim(p_owner_email));
  if v_owner_id is null then
    raise exception 'OWNER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.salons s where s.slug = lower(trim(p_salon_slug))) then
    raise exception 'SLUG_TAKEN' using errcode = '23505';
  end if;

  if p_owner_works and nullif(trim(p_professional_slug), '') is null then
    raise exception 'PROFESSIONAL_SLUG_REQUIRED' using errcode = '22023';
  end if;

  update public.profiles
  set full_name = coalesce(nullif(trim(p_owner_full_name), ''), full_name)
  where id = v_owner_id;

  insert into public.salons (slug, name, kind, status, city, phone, created_by)
  values (lower(trim(p_salon_slug)), trim(p_salon_name), p_salon_kind, 'trial',
          nullif(trim(p_salon_city), ''), nullif(trim(p_salon_phone), ''), coalesce(v_actor, v_owner_id))
  returning id into v_salon_id;

  insert into public.subscriptions (salon_id, plan, status, license_quantity, trial_ends_at)
  values (v_salon_id, 'pilot', 'trialing', p_license_quantity, now() + make_interval(days => p_trial_days));

  insert into public.salon_memberships (salon_id, user_id, role)
  values (v_salon_id, v_owner_id, 'owner');

  if p_owner_works then
    insert into public.salon_memberships (salon_id, user_id, role)
    values (v_salon_id, v_owner_id, 'professional');

    insert into public.professionals (salon_id, user_id, display_name, slug, status, sort_order)
    values (v_salon_id, v_owner_id, trim(p_owner_full_name), lower(trim(p_professional_slug)), 'active', 1)
    returning id into v_professional_id;

    insert into public.license_assignments (salon_id, professional_id, assigned_by)
    values (v_salon_id, v_professional_id, coalesce(v_actor, v_owner_id));
  end if;

  insert into public.audit_logs (salon_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_salon_id, v_actor, 'salon.created', 'salon', v_salon_id,
          jsonb_build_object('owner_user_id', v_owner_id, 'licenses', p_license_quantity,
                             'owner_works', p_owner_works));

  return v_salon_id;
end;
$$;

revoke all on function public.create_salon_with_owner(
  text, text, text, text, public.salon_kind, text, text, integer, boolean, text, integer
) from public, anon;
grant execute on function public.create_salon_with_owner(
  text, text, text, text, public.salon_kind, text, text, integer, boolean, text, integer
) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Vista global para el administrador de la plataforma.
-- Incluye el email del propietario (auth.users no es accesible por RLS).
-- -----------------------------------------------------------------------------
create function public.admin_salon_overview()
returns table (
  salon_id            uuid,
  name                text,
  slug                text,
  kind                public.salon_kind,
  status              public.salon_status,
  city                text,
  created_at          timestamptz,
  subscription_status public.subscription_status,
  license_quantity    integer,
  licenses_in_use     integer,
  professionals       integer,
  owner_email         text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
    select
      s.id, s.name, s.slug, s.kind, s.status, s.city, s.created_at,
      sub.status, coalesce(sub.license_quantity, 0),
      (select count(*)::integer from public.license_assignments la
        where la.salon_id = s.id and la.revoked_at is null),
      (select count(*)::integer from public.professionals p
        where p.salon_id = s.id and p.status <> 'inactive'),
      (select u.email::text from public.salon_memberships m
        join auth.users u on u.id = m.user_id
        where m.salon_id = s.id and m.role = 'owner'
        order by m.created_at limit 1)
    from public.salons s
    left join public.subscriptions sub on sub.salon_id = s.id
    order by s.created_at desc;
end;
$$;

revoke all on function public.admin_salon_overview() from public, anon;
grant execute on function public.admin_salon_overview() to authenticated;
