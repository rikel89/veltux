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
npm run db:types       # regenera los tipos desde el proyecto vinculado
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
    (auth)/                  Login, recuperación, nueva contraseña, sin acceso
    (panel)/profesional/     Panel del profesional
    (panel)/propietario/     Panel del propietario
    (panel)/admin/           Administración de la plataforma
    panel/                   Redirección por rol tras el login
    auth/confirm|callback|signout/  Route Handlers de Supabase Auth
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
  types/database.types.ts    Tipos generados desde PostgreSQL (`npm run db:types`)
  types/database.ts          Alias legibles sobre los tipos generados
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

- Las pruebas SQL usan PGlite con un *stub* de `auth`; las pruebas pgTAP con `supabase test db` requieren Docker.
- La referencia UX/UI (imagen 2) no se recibió; el dashboard sigue la identidad corporativa (imagen 1) y las pautas escritas.
- El solapamiento cita/bloqueo (`schedule_exceptions`) se validará en la función transaccional de reserva (Sprint 4).

## Sprint 1 · Entregado

Detalle completo (historias, criterios de aceptación y configuración de Supabase): [docs/sprints/sprint-1.md](docs/sprints/sprint-1.md).

- [x] Alta cerrada de establecimientos desde `/admin` (invitación + `create_salon_with_owner()` transaccional)
- [x] Invitación, recuperación y cambio de contraseña (`/auth/confirm` con `token_hash`, plantillas en español)
- [x] Entrada por rol (`/panel`) y cambio de área para usuarios con varios roles
- [x] Paneles de propietario (dashboard + configuración) y administración (dashboard + establecimientos)
- [x] Mi perfil y Configuración del profesional
- [x] Autorización por página y en la capa de datos (`requireArea`), además de RLS
- [x] CI en GitHub Actions; pruebas: 79 Vitest y 13 Playwright
- [x] CLI de Supabase vinculada; migraciones aplicadas con `db push` y tipos generados del proyecto real

**Aprendido en el sprint**

- En App Router el layout y la página se renderizan en paralelo: una guarda en el layout no impide que el código de la página se ejecute. Cada página y función de datos comprueba el acceso.
- En Zod 4, `z.email().trim()` valida antes de recortar; los emails se normalizan con `emailSchema()` (recorta y pasa a minúsculas antes de validar).

## Sprint 2 · Entregado

Detalle: [docs/sprints/sprint-2.md](docs/sprints/sprint-2.md).

- [x] Invitación de profesionales por el propietario (email + ficha, membresía y licencia en una transacción)
- [x] Aceptación automática al entrar (`accept_my_invitations()` en `/panel`)
- [x] Gestión de licencias: asignar, liberar con motivo, cupo e historial
- [x] Activar / desactivar profesionales (desactivar libera la licencia; conservan la lectura de sus datos)
- [x] Ajuste manual del cupo por el administrador
- [x] Pruebas: 91 Vitest (12 nuevas del flujo de equipo) y 13 Playwright

## Sprint 3 · Servicios, tarifas y horarios (propuesta)

1. **Mis servicios**: crear, editar, ordenar y desactivar servicios con duración, margen y precio individuales.
2. **Mis horarios**: horario semanal con jornada partida y validación de franjas sin solapes (restricción en PostgreSQL).
3. **Excepciones**: días libres, vacaciones y disponibilidad extra (`schedule_exceptions`).
4. **Cálculo de disponibilidad** en PostgreSQL (`get_available_slots`), base del motor de reservas de los sprints 4 y 5.
5. **Pruebas**: RLS de servicios/horarios, cálculo de huecos con cambios de hora y jornada partida.
