# Sprint 4 · Agenda y clientes

## Historias de usuario y criterios de aceptación

### H1 · Ver mi agenda (profesional)
- [x] `/profesional/agenda`: vista de día y de semana (`?fecha=AAAA-MM-DD&vista=dia|semana`), navegación anterior / hoy / siguiente.
- [x] Muestra el horario laboral (blanco), lo que queda fuera (gris), días libres y bloqueos (rayado), horario extra y la línea de «ahora».
- [x] Las citas se colocan en la hora local del salón, también los días de cambio de hora; las que coinciden se reparten en columnas.
- [x] En móvil la semana se desplaza dentro de su tarjeta, sin scroll horizontal de la página.

### H2 · Crear una cita (profesional)
- [x] «Nueva cita» o tocar un hueco libre abre el panel: cliente, servicio, día y hora.
- [x] Se ofrecen los huecos libres calculados en PostgreSQL; también se puede escribir otra hora.
- [x] Fuera de horario, en un día libre o en el pasado hay que confirmarlo expresamente («Reservar aunque esté fuera de mi horario»).
- [x] Nunca se solapan dos citas ni se pisa el margen del servicio (salvo cita forzada, que omite el margen pero no el solape).
- [x] En móvil, el botón central «Nueva cita» abre directamente el panel.

### H3 · Gestionar una cita (profesional)
- [x] Detalle con cliente (llamar con un toque), servicio, precio y nota.
- [x] Completada / No se presentó (solo cuando ya ha empezado), deshacer, mover de día u hora y cancelar con motivo.
- [x] Cada cambio queda en `appointment_events`.

### H4 · Mis clientes (profesional)
- [x] Cartera privada con búsqueda por nombre o teléfono; activos y archivados.
- [x] Alta completa o rápida (nombre + teléfono) desde el panel de la cita; el teléfono español se normaliza a +34.
- [x] Ficha: datos, notas privadas, consentimiento comercial, visitas, última visita, total gastado e historial.
- [x] Archivar no borra: las citas siguen en el historial.

## Migración

`supabase/migrations/20261105090000_sprint4_agenda.sql`

| Objeto | Qué |
| --- | --- |
| `private.schedule_time()` | Tiempo de trabajo de un rango (horario + extra − excepciones) |
| `private.busy_time()` | Citas activas con su margen |
| `private.assert_slot_free()` | `OUTSIDE_SCHEDULE` / `SLOT_TAKEN` |
| `get_available_slots()` | Reescrita sobre el cálculo compartido (misma semántica) |
| `create_my_appointment()` | Alta serializada por profesional (bloqueo de transacción) |
| `reschedule_my_appointment()` | Mover conservando la duración |
| `set_my_appointment_status()` | Transiciones válidas (`INVALID_TRANSITION`, `NOT_STARTED`) |
| Permisos | Sin INSERT directo en `appointments`; UPDATE directo solo de `notes` |

## Pruebas

- `tests/db/agenda.test.ts`: 16 pruebas (horario, excepciones, solapes, margen, doble reserva, propiedad de servicios y clientes, licencia, transiciones, permisos).
- Pruebas RLS anteriores adaptadas: las restricciones del motor se comprueban como `service_role`.
- `tests/unit/agenda.test.ts`: posiciones con zona horaria, columnas, parámetros de URL, clientes.
- `tests/e2e/agenda.spec.ts`: agenda demo (día, semana, detalle sin acciones) y clientes sin datos ficticios.
- Total: 144 Vitest y 23 Playwright.

## Notas técnicas

- Primera ruta con parámetro dinámico del panel (`/profesional/clientes/[id]`): con Cache Components, `usePathname()` debe ir dentro de `<Suspense>`. La navegación lateral muestra la lista sin elemento activo mientras se resuelve.
- La concurrencia real (dos peticiones simultáneas al mismo hueco) la resuelven el bloqueo por profesional y la restricción EXCLUDE; PGlite no permite probar dos conexiones a la vez, se probará contra Supabase local en el Sprint 8.

## Pendiente

- Arrastrar y soltar citas en la rejilla.
- Avisar de citas que quedan fuera de un horario nuevo o de una excepción.
- Editar la nota de una cita existente desde el panel.
