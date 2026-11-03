-- =============================================================================
-- VELTUX · Alta manual de un establecimiento y su propietario (fase piloto)
--
-- A partir del Sprint 1 lo normal es dar de alta desde /admin/establecimientos.
-- Este script queda como alternativa desde Supabase → SQL Editor.
--   1. Crea antes el usuario en Authentication → Users → Add user
--      (marca "Auto confirm user").
--   2. Edita los valores del bloque CONFIGURACIÓN.
--   3. Ejecuta el script completo. Es atómico: si algo falla, no se guarda nada.
--
-- Usa public.create_salon_with_owner() y, opcionalmente, añade servicios y
-- horario iniciales (configuración real editable, NO citas ni clientes).
-- =============================================================================

do $$
declare
  -- ---------------------------- CONFIGURACIÓN -------------------------------
  v_owner_email       text    := 'tu-email@ejemplo.com';
  v_owner_full_name   text    := 'Nombre Apellido';
  v_salon_name        text    := 'Barbería Elegance';
  v_salon_slug        text    := 'barberia-elegance';   -- URL pública: <dominio>/<slug>
  v_salon_kind        public.salon_kind := 'barberia';  -- barberia | peluqueria | unisex
  v_salon_city        text    := 'Madrid';
  v_salon_phone       text    := null;                  -- formato +34XXXXXXXXX o null
  v_license_quantity  integer := 3;                     -- licencias contratadas en el piloto
  v_professional_slug text    := 'carlos';              -- <dominio>/<salon>/<profesional>
  v_owner_works       boolean := true;                  -- el propietario también atiende con agenda
  v_starter_config    boolean := true;                  -- servicios y horario iniciales
  -- --------------------------------------------------------------------------

  v_salon_id        uuid;
  v_professional_id uuid;
begin
  begin
    v_salon_id := public.create_salon_with_owner(
      v_owner_email, v_owner_full_name, v_salon_name, v_salon_slug, v_salon_kind,
      v_salon_city, v_salon_phone, v_license_quantity, v_owner_works, v_professional_slug
    );
  exception
    when others then
      if sqlerrm = 'OWNER_NOT_FOUND' then
        raise exception 'No existe ningún usuario con el email %. Créalo antes en Authentication → Users.', v_owner_email;
      elsif sqlerrm = 'SLUG_TAKEN' then
        raise exception 'El slug "%" ya está en uso.', v_salon_slug;
      end if;
      raise;
  end;

  select p.id into v_professional_id
  from public.professionals p
  where p.salon_id = v_salon_id and p.slug = lower(v_professional_slug);

  if v_starter_config and v_professional_id is not null then
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

  raise notice 'Establecimiento creado: % (/%) · salon_id=%', v_salon_name, lower(v_salon_slug), v_salon_id;
end;
$$;
