# Sprint 1 · Autenticación, peluquerías y roles

**Decisiones de producto**

- Piloto con **alta cerrada**: solo el administrador de VELTUX crea establecimientos; el propietario entra por invitación.
- **SMTP propio más adelante**: se usa el envío de pruebas de Supabase (pocos correos por hora) hasta el piloto real.
- **Migraciones con la CLI de Supabase** vinculada al proyecto remoto.

## Historias de usuario y criterios de aceptación

### H1 · Alta de establecimiento (administrador)
*Como administrador de VELTUX quiero dar de alta una peluquería y a su propietario para incorporarla al piloto.*

- [x] Formulario en `/admin/establecimientos/nuevo` con propietario, establecimiento, licencias y agenda del propietario.
- [x] La dirección de reservas se sugiere a partir del nombre y se valida igual que en PostgreSQL (formato y lista reservada).
- [x] Se envía una invitación por email; si la cuenta ya existe, se vincula sin reenviar.
- [x] Salón, suscripción piloto, membresías, ficha profesional y licencia se crean en **una transacción** (`create_salon_with_owner`).
- [x] Solo un administrador de plataforma puede ejecutarla (probado: propietario → `FORBIDDEN`, anónimo → sin permiso).
- [x] Queda registro en `audit_logs` (`salon.created`).

### H2 · Invitación y contraseña
*Como propietario invitado quiero crear mi contraseña desde el email para entrar en VELTUX.*

- [x] El enlace del email se verifica en servidor (`/auth/confirm`, `token_hash`) y crea la sesión en cookies.
- [x] `/cuenta/contrasena` exige 8+ caracteres con letra y número, y confirmación.
- [x] Un enlace caducado lleva a `/login` con un aviso claro.
- [x] Plantillas de email en español (`supabase/templates`).

### H3 · Recuperación de contraseña
- [x] `/recuperar` envía el enlace y responde siempre igual (no revela si la cuenta existe).
- [x] Se informa del límite de envíos (HTTP 429).

### H4 · Entrada según el rol
*Como usuario quiero llegar directamente a mi área de trabajo.*

- [x] Tras iniciar sesión, `/panel` redirige: profesional → `/profesional`; solo propietario → `/propietario`; administrador → `/admin`; sin roles → `/sin-acceso`.
- [x] Quien tiene varios roles cambia de área desde el sidebar y el menú de usuario.
- [x] Cada página comprueba el área en servidor (`requireArea`), además de la guarda del layout y de RLS.

### H5 · Panel del propietario
- [x] Dashboard con licencias en uso/contratadas, equipo (sin datos de clientes) y plan piloto.
- [x] Configuración del establecimiento editable (solo columnas permitidas por `GRANT`).

### H6 · Perfil y configuración del profesional
- [x] Mi perfil: nombre visible, presentación, teléfono, color de agenda y reservas online.
- [x] Configuración: cambio de contraseña.

### H7 · Calidad
- [x] Pruebas SQL/RLS de las nuevas funciones, unitarias de reglas de acceso y validaciones, E2E de acceso.
- [x] CI en GitHub Actions: lint, tipos, Vitest y Playwright.

## Migración

`supabase/migrations/20261103160000_sprint1_access.sql`

| Función | Quién | Qué |
| --- | --- | --- |
| `get_my_access()` | autenticado | Roles y establecimientos del usuario |
| `create_salon_with_owner(...)` | admin de plataforma / backend | Alta transaccional completa |
| `admin_salon_overview()` | admin de plataforma | Establecimientos, licencias y email del propietario |
| `private.enforce_license_limit()` | trigger | Ahora también permite asignar al admin de plataforma |

## Configuración necesaria en Supabase (proyecto remoto)

1. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000` (en producción, el dominio de Vercel).
   - Redirect URLs: `http://localhost:3000/**`.
2. **Authentication → Sign In / Providers → Email**: desactivar *Allow new users to sign up* (alta cerrada).
3. **Authentication → Email Templates**: pegar `supabase/templates/invite.html` en *Invite user* y `recovery.html` en *Reset password* (asuntos en el comentario de cada archivo).
4. **`.env.local`**: añadir `SUPABASE_SECRET_KEY` (Project Settings → API Keys → Secret keys). Solo servidor; necesaria para enviar invitaciones.
5. **Administrador**: ejecutar `supabase/scripts/make_platform_admin.sql` con tu email.

## Pendiente / fuera de alcance

- SMTP propio (Resend, Brevo…) antes del piloto con clientes reales.
- Invitación de profesionales por el propietario → Sprint 2.
- Selector cuando un propietario tiene varios establecimientos.
- Pruebas pgTAP contra Supabase real (requiere Docker).
