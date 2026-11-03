-- =============================================================================
-- VELTUX · Datos de prueba para el entorno LOCAL (supabase db reset)
-- Nunca se ejecuta en producción. Contraseña de todos los usuarios locales:
--   veltux-local-2026
-- Clientes y citas están marcados como datos de prueba.
-- =============================================================================

do $$
declare
  v_carlos uuid := '00000000-0000-4000-8000-00000000c001';
  v_javier uuid := '00000000-0000-4000-8000-00000000c002';
  v_salon  uuid := '10000000-0000-4000-8000-00000000e001';
  v_pro_carlos uuid := '20000000-0000-4000-8000-00000000c001';
  v_pro_javier uuid := '20000000-0000-4000-8000-00000000c002';
  v_user record;
begin
  for v_user in
    select * from (values
      (v_carlos, 'carlos@veltux.local', 'Carlos Martín'),
      (v_javier, 'javier@veltux.local', 'Javier Ruiz')
    ) as u(id, email, full_name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_user.id, 'authenticated', 'authenticated', v_user.email,
      extensions.crypt('veltux-local-2026', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', v_user.full_name),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), v_user.id, v_user.id::text,
      jsonb_build_object('sub', v_user.id::text, 'email', v_user.email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end loop;

  insert into public.salons (id, slug, name, kind, status, phone, city, address_line, created_by)
  values (v_salon, 'barberia-elegance', 'Barbería Elegance', 'barberia', 'trial', '+34910000000', 'Madrid',
          'Calle Ejemplo 1', v_carlos);

  insert into public.subscriptions (salon_id, plan, status, license_quantity, trial_ends_at)
  values (v_salon, 'pilot', 'trialing', 3, now() + interval '30 days');

  insert into public.salon_memberships (salon_id, user_id, role) values
    (v_salon, v_carlos, 'owner'),
    (v_salon, v_carlos, 'professional'),
    (v_salon, v_javier, 'professional');

  insert into public.professionals (id, salon_id, user_id, display_name, slug, status, sort_order) values
    (v_pro_carlos, v_salon, v_carlos, 'Carlos Martín', 'carlos', 'active', 1),
    (v_pro_javier, v_salon, v_javier, 'Javier Ruiz', 'javier', 'active', 2);

  insert into public.license_assignments (salon_id, professional_id, assigned_by) values
    (v_salon, v_pro_carlos, v_carlos),
    (v_salon, v_pro_javier, v_carlos);

  insert into public.services (salon_id, professional_id, name, duration_minutes, price_cents, sort_order) values
    (v_salon, v_pro_carlos, 'Corte clásico', 30, 1500, 1),
    (v_salon, v_pro_carlos, 'Corte + barba', 45, 2200, 2),
    (v_salon, v_pro_carlos, 'Arreglo de barba', 20, 1000, 3),
    (v_salon, v_pro_javier, 'Corte degradado', 40, 1800, 1),
    (v_salon, v_pro_javier, 'Corte + barba', 50, 2500, 2);

  -- Horario: L-V jornada partida, sábado mañana.
  insert into public.work_schedules (salon_id, professional_id, weekday, start_time, end_time, valid_from)
  select v_salon, p.id, d.weekday, t.start_time, t.end_time, date '2026-01-01'
  from (values (v_pro_carlos), (v_pro_javier)) as p(id)
  cross join generate_series(1, 5) as d(weekday)
  cross join (values (time '09:00', time '14:00'), (time '16:00', time '20:00')) as t(start_time, end_time);

  insert into public.work_schedules (salon_id, professional_id, weekday, start_time, end_time, valid_from)
  values (v_salon, v_pro_carlos, 6, '09:00', '14:00', date '2026-01-01');

  insert into public.clients (salon_id, professional_id, full_name, phone, notes) values
    (v_salon, v_pro_carlos, 'Prueba Local Uno', '+34600100001', 'Dato de prueba (seed local)'),
    (v_salon, v_pro_carlos, 'Prueba Local Dos', '+34600100002', 'Dato de prueba (seed local)'),
    (v_salon, v_pro_javier, 'Prueba Local Uno', '+34600100001', 'Misma persona, cartera independiente');

  -- Citas de hoy para Carlos (hora local de Madrid).
  insert into public.appointments (salon_id, professional_id, client_id, service_id, starts_at, ends_at, notes)
  select v_salon, v_pro_carlos, c.id, s.id,
         (current_date + x.at_time) at time zone 'Europe/Madrid',
         (current_date + x.at_time) at time zone 'Europe/Madrid' + make_interval(mins => s.duration_minutes),
         'Dato de prueba (seed local)'
  from (values ('Prueba Local Uno', 'Corte clásico', time '10:00'),
               ('Prueba Local Dos', 'Corte + barba', time '17:00')) as x(client_name, service_name, at_time)
  join public.clients c on c.professional_id = v_pro_carlos and c.full_name = x.client_name
  join public.services s on s.professional_id = v_pro_carlos and s.name = x.service_name;
end;
$$;
