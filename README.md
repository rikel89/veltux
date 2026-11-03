# VELTUX

**Tu agenda. Tu negocio. Tu ritmo.**

SaaS multi-tenant de reservas para barberías y peluquerías donde cada profesional autónomo trabaja con su propia agenda, servicios, precios y cartera privada de clientes.

| Capa | Tecnología |
| --- | --- |
| Frontend | Next.js 16 (App Router, Cache Components) · React 19 · TypeScript estricto · Tailwind CSS 4 · shadcn/ui (Radix) · Lucide |
| Backend | Route Handlers + Server Actions · monolito modular · Zod 4 |
| Datos | Supabase PostgreSQL 17 · RLS · migraciones con Supabase CLI |
| Auth | Supabase Auth + `@supabase/ssr` (validación con `getClaims()`) |
| Pruebas | Vitest (unitarias + SQL/RLS sobre PGlite) · Playwright (escritorio y móvil) |
| Despliegue | Vercel (pendiente de autorización) |

---

## Puesta en marcha

Requisitos: **Node.js ≥ 22** (probado con 26 LTS). Para la base de datos local, además **Docker Desktop**.

```bash
npm install
npm run dev            # http://localhost:3000
```

Sin `.env.local` la aplicación arranca en **modo demostración**: el panel muestra datos ficticios etiquetados como `DEMO` y una banda superior lo indica. No hay reservas reales.

### Con Supabase local

```bash
cp .env.example .env.local
npm run db:start       # levanta Supabase en Docker e imprime URL y claves
# copia "API URL" y "Publishable key" en .env.local
npm run db:reset       # aplica migraciones + supabase/seed.sql
npm run db:types       # regenera src/types/database.types.ts
npm run dev
```

Usuarios del seed local (contraseña `veltux-local-2026`): `carlos@veltux.local` (propietario + profesional) y `javier@veltux.local` (profesional).

### Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` / `build` / `start` | Desarrollo, build de producción, servidor de producción |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Todas las pruebas Vitest |
| `npm run test:unit` | Lógica pura y componentes (jsdom) |
| `npm run test:db` | Migraciones + políticas RLS sobre PostgreSQL embebido (PGlite), **sin Docker** |
| `npm run test:e2e` | Playwright (compila y arranca en el puerto 3100; escritorio y Pixel 7) |
| `npm run db:new <nombre>` | Nueva migración SQL |

La primera vez que se ejecute Playwright: `npx playwright install chromium`.

---

## Estructura

```
src/
  app/
    (auth)/login/            Acceso (Server Action + Zod)
    (panel)/profesional/     Panel del profesional (dashboard + secciones por sprint)
    auth/callback|signout/   Route Handlers de Supabase Auth
    page.tsx                 Portada de marca
  components/
    ui/                      shadcn/ui (personalizado con tokens VELTUX)
    brand/                   Logotipo e isotipo en SVG
    layout/                  Shell, sidebar, topbar, barra inferior móvil
    dashboard/               Tarjetas del dashboard profesional
    calendar/                (Sprint 4)
  modules/                   Lógica de negocio, sin JSX
    auth/                    Sesión (DAL), identidad, acciones
    dashboard/               Composición de datos del dashboard (live/demo)
    appointments/ professionals/ scheduling/ …
  lib/
    supabase/                Clientes browser/server/admin + refresco de sesión
    permissions/             Rutas protegidas, redirecciones seguras
    datetime.ts format.ts    Zonas horarias (Intl) y formato es-ES
  types/database.types.ts    Tipos de la BD (provisional → `npm run db:types`)
  proxy.ts                   Proxy de Next 16 (antes middleware)
supabase/
  migrations/                Esquema + RLS
  seed.sql                   Datos locales de prueba
tests/
  unit/  db/  e2e/
```

---

## Decisiones de arquitectura

1. **Tenant = `salons`; propietario de los datos = `professionals`.** Clientes, servicios, horarios y citas cuelgan del profesional. Las claves foráneas compuestas (`(client_id, professional_id)`, `(service_id, professional_id)`, `(professional_id, salon_id)`) hacen imposible que una cita use un cliente o servicio de otro profesional o de otra peluquería.
2. **Anti-solapamiento en PostgreSQL.** `EXCLUDE USING gist (professional_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE status IN ('pending','confirmed')`. Dos profesionales pueden coincidir; un mismo profesional, no. Error `23P01` → «hueco ocupado».
3. **El propietario no lee `appointments` ni `clients`.** Consulta la ocupación con `get_salon_occupancy()`, que solo devuelve `professional_id, starts_at, ends_at`.
4. **Portal público sin acceso a tablas.** El rol `anon` no tiene privilegios sobre ninguna tabla; solo puede ejecutar `get_public_salon(slug)`, que devuelve un JSON acotado.
5. **Privilegios por columna.** Además de RLS, `GRANT UPDATE (col, …)` impide, por ejemplo, mover una cita a otra agenda, cambiarse el `platform_role` o modificar la cantidad de licencias.
6. **Bitácora automática.** Los triggers registran cada alta/cambio de cita en `appointment_events` y cada asignación/revocación de licencia en `audit_logs`.
7. **Licencias con límite transaccional.** El trigger bloquea la fila de `subscriptions` (`FOR UPDATE`) antes de contar licencias activas: dos altas simultáneas no pueden superar el cupo.
8. **Notificaciones como outbox.** `notifications` con `idempotency_key` única, estados `pending → processing → sent → delivered | failed`, reintentos (`attempts`, `next_attempt_at`) y `claim_pending_notifications()` con `FOR UPDATE SKIP LOCKED`, ejecutable solo por `service_role`. No hay envíos simulados.
9. **Identidad global de cliente preparada.** `clients.global_client_id` queda reservado (sin FK) para enlazar en el futuro fichas de distintos profesionales sin compartir datos.
10. **Cache Components activado** (por defecto en Next 16.4): toda lectura de sesión vive dentro de `<Suspense>`; la estructura del panel se prerenderiza.
11. **Claves Supabase nuevas:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en cliente; `SUPABASE_SECRET_KEY` solo en servidor (`server-only` rompe el build si se importa en el navegador).

### Matriz de acceso (verificada en `tests/db/rls.test.ts`)

| Recurso | Profesional (propio) | Compañero del salón | Propietario | Otra peluquería | Anónimo |
| --- | --- | --- | --- | --- | --- |
| Clientes | CRUD (sin borrar) | — | — | — | — |
| Citas | Crear / modificar / cancelar | — | Solo ocupación (RPC) | — | — |
| Servicios | CRUD | Lectura | Lectura | — | RPC pública |
| Licencias | Lectura propia | — | Asignar / revocar | — | — |
| Profesionales | Editar su perfil (no su estado) | Lectura | Alta / estado | — | RPC pública |

---

## Sprint 0 · Entregado

- [x] Next.js 16 + TypeScript estricto + Tailwind 4 + shadcn/ui + Lucide
- [x] Supabase JS + `@supabase/ssr` (clientes browser/server/admin, proxy de sesión, callback y logout)
- [x] Estructura modular `app / components / modules / lib / types`
- [x] Variables de entorno (`.env.example`) y modo demostración explícito
- [x] Migración inicial: 16 tablas, enums, índices, restricciones, triggers, RLS y funciones
- [x] Sistema de diseño VELTUX (tokens, Manrope, variantes de botón, logotipo SVG)
- [x] Layout principal: sidebar negro, barra superior, barra inferior móvil con acción central
- [x] Dashboard profesional (datos reales con Supabase; `DEMO` sin él)
- [x] Login con validación Zod y redirección segura
- [x] Pruebas: 50 Vitest (32 de RLS/integridad + 3 del seed) y 8 Playwright (escritorio + móvil)

**Limitaciones conocidas**

- `src/types/database.types.ts` está escrito a mano; se sustituirá con `npm run db:types` cuando haya Supabase local.
- Las pruebas SQL usan PGlite con un *stub* de `auth`; en el Sprint 1 se añadirán pruebas pgTAP con `supabase test db` contra el stack real.
- La referencia UX/UI (imagen 2) no se recibió; el dashboard sigue la identidad corporativa (imagen 1) y las pautas escritas.
- El solapamiento cita/bloqueo (`schedule_exceptions`) se validará en la función transaccional de reserva (Sprint 4).

## Sprint 1 · Autenticación, peluquerías y roles (propuesta)

1. **Registro de propietario + alta de peluquería** en una única función transaccional `create_salon_with_owner()` (salón, membresía owner, suscripción piloto, slug validado).
2. **Recuperación de contraseña** y confirmación de email (plantillas en español en `supabase/templates`).
3. **Selector de rol / establecimiento** tras el login (propietario ↔ profesional) y redirección por rol.
4. **Layouts de propietario (`/propietario`) y administración (`/admin`)** con su navegación y guardas de servidor.
5. **Mi perfil y Configuración** del profesional (actualización por columnas permitidas).
6. **Invitaciones**: tabla `invitations` (token con hash, caducidad) y aceptación que vincula `user_id`.
7. **Pruebas**: pgTAP con `supabase test db`, E2E de login/logout con usuarios del seed, CI en GitHub Actions (lint, typecheck, Vitest, Playwright).
8. **Tipos generados** y eliminación del archivo provisional.
