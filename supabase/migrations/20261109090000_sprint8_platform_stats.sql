-- =============================================================================
-- VELTUX · Sprint 8 · Estadísticas de la plataforma
--
-- Solo cifras agregadas para el administrador: nunca clientes, teléfonos, notas
-- ni citas individuales. La cartera sigue siendo privada de cada autónomo.
-- =============================================================================

create function public.admin_platform_stats(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_since timestamptz;
begin
  if not private.is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_days is null or p_days not between 1 and 365 then
    raise exception 'INVALID_RANGE' using errcode = '22023';
  end if;
  v_since := now() - make_interval(days => p_days);

  return jsonb_build_object(
    'days', p_days,
    'salons_live', (select count(*) from public.salons s where s.status in ('trial', 'active')),
    'professionals_active', (select count(*) from public.professionals p where p.status = 'active'),
    'clients', (select count(*) from public.clients c where c.archived_at is null),
    'appointments', (
      select jsonb_build_object(
        'total', count(*),
        'online', count(*) filter (where a.source = 'public_portal'),
        'completed', count(*) filter (where a.status = 'completed'),
        'cancelled', count(*) filter (where a.status = 'cancelled'),
        'no_show', count(*) filter (where a.status = 'no_show')
      )
      from public.appointments a
      where a.created_at >= v_since
    ),
    'notifications', (
      select jsonb_build_object(
        'pending', count(*) filter (where n.status in ('pending', 'processing')),
        'sent', count(*) filter (where n.status = 'sent'),
        'delivered', count(*) filter (where n.status = 'delivered'),
        'failed', count(*) filter (where n.status = 'failed')
      )
      from public.notifications n
    ),
    'salons', coalesce((
      select jsonb_agg(row_to_json(r) order by r.appointments desc, r.name)
      from (
        select s.id, s.name, s.status,
               (select count(*) from public.professionals p where p.salon_id = s.id and p.status = 'active') as professionals,
               (select count(*) from public.appointments a where a.salon_id = s.id and a.created_at >= v_since) as appointments,
               (select count(*) from public.appointments a where a.salon_id = s.id and a.created_at >= v_since and a.source = 'public_portal') as online
        from public.salons s
      ) r
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_platform_stats(integer) from public, anon;
grant execute on function public.admin_platform_stats(integer) to authenticated;
