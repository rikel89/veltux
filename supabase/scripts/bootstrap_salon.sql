-- =============================================================================
-- VELTUX · Alta manual de un establecimiento y su propietario (fase piloto)
--
-- Uso: Supabase → SQL Editor. Ejecutar UNA vez por establecimiento.
--   1. Crea antes el usuario en Authentication → Users → Add user
--      (marca "Auto confirm user").
--   2. Edita los valores del bloque CONFIGURACIÓN.
--   3. Ejecuta el script completo. Es atómico: si algo falla, no se guarda nada.
--
-- Crea: salón, suscripción piloto, membresías (propietario + profesional),
-- ficha profesional, licencia y, opcionalmente, servicios y horario iniciales
-- (configuración real editable, NO citas ni clientes ficticios).
--
-- Sustituto temporal del registro de peluquerías, que llega en el Sprint 1.
-- =============================================================================

do $$
declare
  -- ---------------------------- CONFIGURACIÓN -------------------------------
  v_owner_email       text    := 'tu-email@ejemplo.com';
  v_owner_full_name   text    := 'Nombre Apellido';
  v_salon_name        text    := 'Barbería Elegance';
  v_salon_slug        text    := 'barberia-elegance';   -- URL pública: veltux.es/<slug>
  v_salon_kind        public.salon_kind := 'barberia';  -- barberia | peluqueria | unisex
  v_salon_city        text    := 'Madrid';
  v_salon_phone       text    := null;                  -- formato +34XXXXXXXXX o null
  v_license_quantity  integer := 3;                     -- licencias contratadas en el piloto
  v_professional_slug text    := 'carlos';              -- veltux.es/<salon>/<profesional>
  v_owner_works       boolean := true;                  -- el propietario también atiende con agenda
  v_starter_config    boolean := true;                  -- servicios y horario iniciales
  -- --------------------------------------------------------------------------

  v_user_id         uuid;
  v_salon_id        uuid;
  v_professional_id uuid;
begin
  select u.id into v_user_id from auth.users u where lower(u.email) = lower(v_owner_email);
  if v_user_id is null then
    raise exception 'No existe ningún usuario con el email %. Créalo antes en Authentication → Users.', v_owner_email;
  end if;

  if exists (select 1 from public.salons s where s.slug = lower(v_salon_slug)) then
    raise exception 'El slug "%" ya está en uso.', v_salon_slug;
  end if;

  update public.profiles set full_name = v_owner_full_name where id = v_user_id;

  insert into public.salons (slug, name, kind, status, city, phone, created_by)
  values (lower(v_salon_slug), v_salon_name, v_salon_kind, 'trial', v_salon_city, v_salon_phone, v_user_id)
  returning id into v_salon_id;

  insert into public.subscriptions (salon_id, plan, status, license_quantity, trial_ends_at)
  values (v_salon_id, 'pilot', 'trialing', v_license_quantity, now() + interval '90 days');

  insert into public.salon_memberships (salon_id, user_id, role)
  values (v_salon_id, v_user_id, 'owner');

  if v_owner_works then
    insert into public.salon_memberships (salon_id, user_id, role)
    values (v_salon_id, v_user_id, 'professional');

    insert into public.professionals (salon_id, user_id, display_name, slug, status, sort_order)
    values (v_salon_id, v_user_id, v_owner_full_name, lower(v_professional_slug), 'active', 1)
    returning id into v_professional_id;

    insert into public.license_assignments (salon_id, professional_id, assigned_by)
    values (v_salon_id, v_professional_id, v_user_id);

    if v_starter_config then
      insert into public.services (salon_id, professional_id, name, duration_minutes, price_cents, sort_order) values
        (v_salon_id, v_professional_id, 'Corte clásico', 30, 1500, 1),
        (v_salon_id, v_professional_id, 'Corte + barba', 45, 2200, 2),
        (v_salon_id, v_professional_id, 'Arreglo de barba', 20, 1000, 3);

      -- Lunes a viernes 09:00–14:00 y 16:00–20:00; sábado 09:00–14:00.
      insert into public.work_schedules (salon_id, professional_id, weekday, start_time, end_time)
      select v_salon_id, v_professional_id, d.weekday, t.start_time, t.end_time
      from generate_series(1, 5) as d(weekday)
      cross join (values (time '09:00', time '14:00'), (time '16:00', time '20:00')) as t(start_time, end_time)
      union all
      select v_salon_id, v_professional_id, 6, time '09:00', time '14:00';
    end if;
  end if;

  insert into public.audit_logs (salon_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_salon_id, v_user_id, 'salon.bootstrapped', 'salon', v_salon_id,
          jsonb_build_object('licenses', v_license_quantity, 'owner_works', v_owner_works, 'source', 'bootstrap_salon.sql'));

  raise notice 'Establecimiento creado: % (veltux.es/%) · salon_id=%', v_salon_name, lower(v_salon_slug), v_salon_id;
end;
$$;
