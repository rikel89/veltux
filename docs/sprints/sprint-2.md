# Sprint 2 · Profesionales y licencias

## Historias de usuario y criterios de aceptación

### H1 · Invitar a un profesional (propietario)
*Como propietario quiero invitar a los autónomos de mi peluquería para que tengan su propia agenda.*

- [x] Formulario en `/propietario/profesionales`: nombre visible, email, dirección de agenda y licencia opcional.
- [x] Se envía la invitación de Supabase Auth; si la persona ya tiene cuenta, se vincula sin email nuevo.
- [x] Ficha, membresía y licencia se crean en una transacción (`invite_professional`); sin licencias libres no se crea nada.
- [x] Se rechazan duplicados (`ALREADY_MEMBER`) y direcciones ocupadas (`SLUG_TAKEN`).
- [x] Solo el propietario de ese establecimiento (o el administrador) puede invitar.

### H2 · Aceptar la invitación (profesional)
- [x] Al crear su contraseña y entrar, `/panel` ejecuta `accept_my_invitations()`: ficha y membresía pasan a activas.
- [x] Mientras la invitación está pendiente no puede crear clientes ni citas (RLS).

### H3 · Gestionar licencias (propietario)
- [x] `/propietario/licencias`: cupo en uso/contratado, asignar y liberar.
- [x] Liberar exige motivo; queda en `license_assignments` (nunca se borra) y en `audit_logs`.
- [x] El límite contratado se respeta en PostgreSQL con bloqueo de fila (dos asignaciones simultáneas no lo superan).
- [x] No se puede asignar licencia a un profesional desactivado (`PROFESSIONAL_INACTIVE`).

### H4 · Activar / desactivar profesionales (propietario)
- [x] Desactivar pide confirmación, libera la licencia y retira las reservas online, en una transacción.
- [x] El profesional desactivado **conserva la lectura** de su cartera y su agenda (son datos de un autónomo), sin poder modificar nada.
- [x] Una invitación pendiente solo la activa el propio profesional.

### H5 · Ajustar el cupo (administrador)
- [x] `/admin/licencias`: cupo editable por establecimiento, nunca por debajo de las licencias en uso (`BELOW_IN_USE`).
- [x] Cambio auditado (`subscription.licenses_changed` con valor anterior y nuevo). Un propietario no puede ampliarse el cupo.

## Migración

`supabase/migrations/20261103200000_sprint2_team.sql` (aplicada en el proyecto remoto con `supabase db push`).

| Función | Quién | Qué |
| --- | --- | --- |
| `invite_professional(...)` | propietario / admin | Ficha + membresía `invited` + licencia opcional |
| `accept_my_invitations()` | el propio usuario | Activa sus invitaciones pendientes |
| `set_professional_active(...)` | propietario / admin | Activa o desactiva (desactivar libera licencia) |
| `admin_set_license_quantity(...)` | admin | Ajusta el cupo contratado |
| `private.enforce_license_limit()` | trigger | Además rechaza profesionales inactivos |

## Pruebas

- `tests/db/team.test.ts`: 12 pruebas del flujo completo (invitar, aceptar, desactivar, licencias, cupo, permisos).
- Total: 91 Vitest y 13 Playwright.

## Pendiente

- Reenviar o cancelar una invitación pendiente.
- Reordenar profesionales (orden de aparición en la página pública).
- Notificar por email al propietario cuando un profesional acepta.
