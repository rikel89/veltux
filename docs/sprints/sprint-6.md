# Sprint 6 · Imprevistos y notificaciones

## Historias de usuario y criterios de aceptación

### H1 · Gestionar un imprevisto (profesional)
- [x] `/profesional/imprevistos`: elegir una jornada y ver todas las citas activas afectadas.
- [x] Bloquear la jornada: deja de ofrecer huecos; las citas no cambian. Repetirlo no duplica nada.
- [x] Cancelar una cita o todas las de la jornada, con confirmación.
- [x] Proponer otra hora: la cita no cambia hasta que el cliente acepta.
- [x] Solicitar una reasignación a un compañero del establecimiento.
- [x] Retirar una propuesta abierta. Cada cita admite una sola propuesta abierta.

### H2 · Reasignación con doble aceptación
1. [x] El profesional original la solicita; la cita sigue en su agenda.
2. [x] El receptor la ve con día, hora, servicio y precio, **sin datos del cliente**.
3. [x] Al aceptar elige su propio servicio y se comprueba su disponibilidad.
4. [x] El cliente recibe profesional, servicio y precio, y confirma o rechaza.
5. [x] Al confirmar, la cita pasa de agenda en una transacción. El receptor recibe solo nombre y teléfono; las notas privadas no viajan. Si ya tenía a esa persona, se reutiliza su ficha.

### H3 · La página del cliente
- [x] `/cita/{id}.{firma}`, sin cuenta: ver la cita, responder a la propuesta y cancelar.
- [x] La firma (HMAC) no se guarda en ninguna tabla. Una firma incorrecta muestra «No encontramos esta página».
- [x] Las acciones del cliente quedan registradas como `actor_kind = client`.

### H4 · Notificaciones
- [x] Cola persistente `notifications` con clave de idempotencia.
- [x] Eventos: nueva reserva, recordatorio 24 h antes, cancelación, reprogramación propuesta, reasignación propuesta y cambio confirmado.
- [x] Reintentos con espera exponencial; agotados los intentos queda como fallida. Un proceso caído no deja mensajes bloqueados y los avisos de citas ya pasadas no se envían.
- [x] Estados: Pendiente, Enviada, Entregada y Fallida.
- [x] **Sin proveedor no se simula nada**: el procesador no toca la cola y `/profesional/notificaciones` avisa de que no se ha enviado ningún mensaje.
- [x] Los SMS no incluyen notas ni motivos.

## Pendiente de decisión

- **Proveedor de SMS.** Se conecta en `getRealSmsSender()` (`src/lib/sms/index.ts`). También falta su webhook de entrega, que llamará a `record_notification_delivered`; hasta entonces ningún mensaje pasa a «Entregada».
- **Tarea programada.** `GET /api/internal/notifications/process` necesita `CRON_SECRET` y alguien que la invoque cada pocos minutos. El plan gratuito de Vercel solo permite tareas diarias: se decide al desplegar.

## Migración

`supabase/migrations/20261107090000_sprint6_incidents_notifications.sql`

| Objeto | Qué |
| --- | --- |
| `salons_slug_not_route` | Reserva `panel`, `cuenta`, `recuperar`, `sin-acceso` y `cita` |
| `private.notify_appointment_change()` | Trigger que encola los SMS y anula propuestas obsoletas |
| `claim_pending_notifications()`, `record_notification_result()`, `record_notification_delivered()` | Procesamiento de la cola (solo `service_role`) |
| `block_my_day()`, `cancel_my_day_appointments()` | Jornada e incidente |
| `propose_reschedule()`, `request_reassignment()`, `respond_my_reassignment()`, `my_incoming_reassignments()`, `cancel_my_change_request()` | Propuestas |
| `get_appointment_for_client()`, `respond_change_request_as_client()`, `cancel_appointment_as_client()` | Cliente (solo `service_role`) |

Se elimina la inserción directa en `appointment_change_requests`.

## Pruebas

- `tests/db/incidents.test.ts`: 24 pruebas (cola, reintentos, idempotencia, imprevistos, reprogramación, reasignación completa, privacidad, caducidad y permisos).
- `tests/unit/notifications.test.ts`: textos, procesador con proveedor falso, firma de enlaces.
- `tests/e2e/incidents.spec.ts`: sin datos ficticios, enlace falso y cola protegida.

## Pendiente

- Marcar un incidente como resuelto; el desbloqueo se hace eliminando el día libre en *Mis horarios*.
- Avisar al profesional en el panel cuando un cliente responde.
- Probar con dos conexiones simultáneas contra un Supabase local (Sprint 8).
