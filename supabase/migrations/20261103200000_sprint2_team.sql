-- =============================================================================
-- VELTUX · Sprint 2 · Profesionales y licencias
--
-- Flujo de invitación:
--   1. El propietario invita (la app envía el email de Supabase Auth y llama
--      a invite_professional): ficha y membresía quedan en estado 'invited'.
--   2. El profesional crea su contraseña y entra: accept_my_invitations()
--      activa su ficha y su membresía.
--
-- Un profesional desactivado conserva la LECTURA de su cartera y su agenda
-- (son datos de un autónomo), pero no puede crear ni modificar nada y libera
-- su licencia.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Licencias: no se asignan a profesionales desactivados.
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

  if exists (select 1 from public.professionals p where p.id = new.professional_id and p.status = 'inactive') then
    raise exception 'PROFESSIONAL_INACTIVE' using errcode = 'P0001';
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
-- Invitar a un profesional a un establecimiento.
-- El usuario debe existir en auth.users (la app lo invita antes por email).
-- -----------------------------------------------------------------------------
create function public.invite_professional(
  p_salon_id       uuid,
  p_email          text,
  p_display_name   text,
  p_slug           text,
  p_assign_license boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor           uuid := (select auth.uid());
  v_user_id         uuid;
  v_professional_id uuid;
begin
  if not (private.is_salon_owner(p_salon_id) or private.is_platform_admin()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select u.id into v_user_id from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.professionals p where p.salon_id = p_salon_id and p.user_id = v_user_id) then
    raise exception 'ALREADY_MEMBER' using errcode = '23505';
  end if;

  if exists (select 1 from public.professionals p where p.salon_id = p_salon_id and p.slug = lower(trim(p_slug))) then
    raise exception 'SLUG_TAKEN' using errcode = '23505';
  end if;

  insert into public.salon_memberships (salon_id, user_id, role, status)
  values (p_salon_id, v_user_id, 'professional', 'invited')
  on conflict (salon_id, user_id, role) do update set status = 'invited';

  insert into public.professionals (salon_id, user_id, display_name, slug, email, status, sort_order)
  values (
    p_salon_id, v_user_id, trim(p_display_name), lower(trim(p_slug)), lower(trim(p_email)), 'invited',
    coalesce((select max(p.sort_order) + 1 from public.professionals p where p.salon_id = p_salon_id), 1)
  )
  returning id into v_professional_id;

  if p_assign_license then
    -- El trigger de licencias aplica el límite contratado (LICENSE_LIMIT_REACHED).
    insert into public.license_assignments (salon_id, professional_id, assigned_by)
    values (p_salon_id, v_professional_id, v_actor);
  end if;

  insert into public.audit_logs (salon_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (p_salon_id, v_actor, 'professional.invited', 'professional', v_professional_id,
          jsonb_build_object('email', lower(trim(p_email)), 'license', p_assign_license));

  return v_professional_id;
end;
$$;

revoke all on function public.invite_professional(uuid, text, text, text, boolean) from public, anon;
grant execute on function public.invite_professional(uuid, text, text, text, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- El usuario acepta sus invitaciones pendientes (se llama al entrar en /panel).
-- -----------------------------------------------------------------------------
create function public.accept_my_invitations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_count integer;
begin
  if v_user is null then
    return 0;
  end if;

  update public.salon_memberships m
  set status = 'active'
  where m.user_id = v_user and m.status = 'invited';

  with activated as (
    update public.professionals p
    set status = 'active'
    where p.user_id = v_user and p.status = 'invited'
    returning p.id, p.salon_id
  ),
  logged as (
    insert into public.audit_logs (salon_id, actor_user_id, action, entity_type, entity_id)
    select a.salon_id, v_user, 'professional.joined', 'professional', a.id from activated a
    returning 1
  )
  select count(*) into v_count from logged;

  return v_count;
end;
$$;

revoke all on function public.accept_my_invitations() from public, anon;
grant execute on function public.accept_my_invitations() to authenticated;

-- -----------------------------------------------------------------------------
-- Activar / desactivar un profesional. Desactivar libera su licencia.
-- -----------------------------------------------------------------------------
create function public.set_professional_active(
  p_professional_id uuid,
  p_active          boolean,
  p_reason          text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_pro   public.professionals%rowtype;
begin
  select * into v_pro from public.professionals p where p.id = p_professional_id for update;
  if v_pro.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if not (private.is_salon_owner(v_pro.salon_id) or private.is_platform_admin()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_active then
    -- Una invitación solo la activa el propio profesional al aceptarla.
    if v_pro.status <> 'inactive' then
      raise exception 'INVALID_TRANSITION' using errcode = '22023';
    end if;
    update public.professionals set status = 'active' where id = v_pro.id;
  else
    if v_pro.status = 'inactive' then
      raise exception 'INVALID_TRANSITION' using errcode = '22023';
    end if;
    update public.professionals set status = 'inactive', accepts_online_booking = false where id = v_pro.id;
    update public.license_assignments
    set revoked_at = now(), revoked_by = v_actor,
        revoke_reason = coalesce(nullif(trim(p_reason), ''), 'Profesional desactivado')
    where professional_id = v_pro.id and revoked_at is null;
  end if;

  insert into public.audit_logs (salon_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_pro.salon_id, v_actor,
          case when p_active then 'professional.activated' else 'professional.deactivated' end,
          'professional', v_pro.id, jsonb_build_object('reason', p_reason));
end;
$$;

revoke all on function public.set_professional_active(uuid, boolean, text) from public, anon;
grant execute on function public.set_professional_active(uuid, boolean, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Licencias contratadas: ajuste manual por el administrador durante el piloto.
-- -----------------------------------------------------------------------------
create function public.admin_set_license_quantity(p_salon_id uuid, p_quantity integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_in_use   integer;
  v_previous integer;
begin
  if not private.is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select s.license_quantity into v_previous
  from public.subscriptions s where s.salon_id = p_salon_id for update;
  if v_previous is null then
    raise exception 'NO_SUBSCRIPTION' using errcode = 'P0002';
  end if;

  select count(*) into v_in_use
  from public.license_assignments la where la.salon_id = p_salon_id and la.revoked_at is null;
  if p_quantity < v_in_use then
    raise exception 'BELOW_IN_USE' using errcode = '22023';
  end if;

  update public.subscriptions set license_quantity = p_quantity where salon_id = p_salon_id;

  insert into public.audit_logs (salon_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (p_salon_id, (select auth.uid()), 'subscription.licenses_changed', 'subscription', p_salon_id,
          jsonb_build_object('from', v_previous, 'to', p_quantity));
end;
$$;

revoke all on function public.admin_set_license_quantity(uuid, integer) from public, anon;
grant execute on function public.admin_set_license_quantity(uuid, integer) to authenticated;
