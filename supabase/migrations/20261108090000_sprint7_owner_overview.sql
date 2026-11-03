-- =============================================================================
-- VELTUX · Sprint 7 · Panel del propietario
--
-- Vista general de agendas: el propietario consulta la ocupación, nunca quién
-- viene ni por qué un profesional no está disponible. La función devuelve solo
-- franjas anónimas; sigue sin poder leer citas, clientes ni excepciones.
-- =============================================================================

create function public.get_salon_agenda_overview(p_salon_id uuid, p_from timestamptz, p_to timestamptz)
returns table (professional_id uuid, kind text, starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.is_salon_owner(p_salon_id) or private.is_platform_admin()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '31 days' then
    raise exception 'INVALID_RANGE' using errcode = '22023';
  end if;

  return query
    select a.professional_id, 'busy'::text, a.starts_at, a.ends_at
    from public.appointments a
    where a.salon_id = p_salon_id
      and a.status in ('pending', 'confirmed', 'completed')
      and a.starts_at < p_to and a.ends_at > p_from
    union all
    select e.professional_id,
           case when e.type = 'extra_availability' then 'extra' else 'unavailable' end,
           e.starts_at, e.ends_at
    from public.schedule_exceptions e
    where e.salon_id = p_salon_id
      and e.starts_at < p_to and e.ends_at > p_from
    order by 3;
end;
$$;

revoke all on function public.get_salon_agenda_overview(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_salon_agenda_overview(uuid, timestamptz, timestamptz) to authenticated;
