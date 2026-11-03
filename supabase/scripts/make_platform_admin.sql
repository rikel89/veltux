-- =============================================================================
-- VELTUX · Conceder el rol de administrador de la plataforma
--
-- Uso: Supabase → SQL Editor. Da acceso a /admin (alta de establecimientos,
-- vista global). No da acceso a clientes ni citas de ningún profesional.
-- Ningún usuario puede concederse este rol desde la aplicación.
-- =============================================================================

update public.profiles p
set platform_role = 'admin'
from auth.users u
where u.id = p.id
  and lower(u.email) = lower('tu-email@ejemplo.com')
returning p.id, u.email, p.platform_role;

-- Para retirarlo:
-- update public.profiles set platform_role = 'user'
-- where id = (select id from auth.users where lower(email) = lower('tu-email@ejemplo.com'));
