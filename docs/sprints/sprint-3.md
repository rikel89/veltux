# Sprint 3 · Servicios, horarios y disponibilidad

## Historias de usuario y criterios de aceptación

### H1 · Mi catálogo de servicios (profesional)
*Como profesional autónomo quiero definir mis servicios con mi duración y mi precio.*

- [x] `/profesional/servicios`: alta y edición con nombre, duración, margen posterior, precio en euros y descripción.
- [x] Duración y margen en múltiplos de 5 minutos; el precio admite «15», «15,50» o «15.50 €».
- [x] «Reservable online» (público) y «Activo» son independientes: un servicio privado solo se usa desde la agenda.
- [x] Eliminar un servicio con citas lo desactiva en su lugar (la FK conserva el histórico).
- [x] Nadie más del establecimiento puede crear ni modificar mis servicios (RLS + GRANT por columna).

### H2 · Mi horario semanal (profesional)
- [x] Editor por días con interruptor libre/trabaja, jornada partida (hasta 4 franjas por día) y «copiar el lunes a martes–viernes».
- [x] Los solapes se señalan al momento en el navegador y PostgreSQL los rechaza siempre (`work_schedules_no_overlap`).
- [x] Guardar crea una **versión nueva desde hoy** (zona del salón): el horario anterior se cierra ayer, así la ocupación histórica no cambia.
- [x] Solo se modifica con `replace_my_weekly_schedule()`; la escritura directa en la tabla está revocada.

### H3 · Días libres, bloqueos y horario extra (profesional)
- [x] Días libres o vacaciones por rango de fechas (máximo 92 días), bloqueos de horas y horario extra fuera del habitual.
- [x] La nota es privada: ni el propietario ni otros profesionales la ven; tampoco el cálculo público de huecos.
- [x] El autor (`created_by`) lo fija el servidor.

### H4 · Disponibilidad (base del motor de reservas)
- [x] `get_available_slots(servicio, desde, hasta, paso)` calcula en PostgreSQL:
  (horario vigente ∪ horario extra) − (días libres ∪ bloqueos ∪ descansos ∪ citas activas + margen).
- [x] Respeta la zona horaria del salón y los cambios de hora.
- [x] Solo devuelve huecos futuros; rango máximo de 31 días.
- [x] Público: solo servicios activos y públicos de profesionales activos, con licencia y reservas online, en salones en prueba o activos (`NOT_BOOKABLE` en otro caso). El propio profesional ve también sus servicios privados.
- [x] Vista previa en *Mis horarios* («Comprobar disponibilidad»): es una consulta, no reserva nada.

## Migración

`supabase/migrations/20261104090000_sprint3_scheduling.sql`

| Objeto | Qué |
| --- | --- |
| `work_schedules_no_overlap` | EXCLUDE por profesional, día, franja y vigencia |
| `work_schedules_five_minute_grid` | Horas en múltiplos de 5 minutos |
| `replace_my_weekly_schedule(uuid, jsonb)` | Sustituye el horario desde hoy (versionado, auditado `schedule.updated`) |
| `schedule_exceptions_max_length` | Excepciones de 92 días como máximo |
| `private.prepare_schedule_exception()` | Fija `created_by` |
| `get_available_slots(uuid, date, date, int)` | Huecos libres (anon y authenticated) |

## Pruebas

- `tests/db/scheduling.test.ts`: 18 pruebas (versionado, solapes, permisos, huecos con jornada partida, cambio de hora, citas y margen, excepciones, reglas de visibilidad pública, privacidad de excepciones).
- `tests/unit/scheduling.test.ts`: validaciones de horario, excepciones, precios y formato.
- `tests/e2e/scheduling.spec.ts`: catálogo y editor de horarios en modo demostración (escritorio y móvil).
- Total: 120 Vitest y 17 Playwright.

## Pendiente

- Reordenar servicios (arrastrar) y orden en la página pública.
- Avisar de citas ya reservadas que quedan fuera de un horario nuevo o de una excepción (Sprint 4, con la agenda).
- Antelación mínima y horizonte máximo de reserva configurables (Sprint 5, portal público).
