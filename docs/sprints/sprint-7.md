# Sprint 7 · Panel del propietario

## Historias de usuario y criterios de aceptación

### H1 · Ver la ocupación de la semana (propietario)
- [x] `/propietario/agendas`: tabla de profesionales por día con el porcentaje de ocupación y el total semanal.
- [x] Tocar un día abre su vista detallada.
- [x] El tiempo de trabajo cuenta el horario vigente ese día y el horario extra, y descuenta lo no disponible. Una versión antigua del horario no altera semanas pasadas.

### H2 · Ver un día (propietario)
- [x] Una columna por profesional: horario, franjas ocupadas (solo la hora) y «No disponible».
- [x] Es de solo lectura: no hay botones ni enlaces a citas.
- [x] En móvil la rejilla se desplaza dentro de su tarjeta.

### H3 · Resumen del establecimiento (propietario)
- [x] Ocupación, tiempo reservado y tiempo libre del periodo visible.
- [x] El dashboard muestra la ocupación de la semana en curso.
- [x] Los totales se calculan sobre minutos, no como media de porcentajes.

### H4 · Privacidad
- [x] `get_salon_agenda_overview()` devuelve solo profesional, tipo y horas: ni clientes, ni servicios, ni precios, ni motivos.
- [x] Las citas canceladas no cuentan.
- [x] El propietario sigue sin poder leer ni modificar citas, clientes y excepciones de otros autónomos.

No hay métricas de ingresos: el precio de cada cita es información del autónomo.

## Migración

`supabase/migrations/20261108090000_sprint7_owner_overview.sql`

| Objeto | Qué |
| --- | --- |
| `get_salon_agenda_overview(uuid, timestamptz, timestamptz)` | Franjas anónimas `busy`, `unavailable` y `extra` (propietario o plataforma; máximo 31 días) |

## Pruebas

- `tests/db/owner.test.ts`: 5 pruebas (datos anónimos, canceladas, permisos, rango, sin acceso directo).
- `tests/unit/owner-overview.test.ts`: cálculo de carga, vigencia del horario, solapes, agregados y rejilla.
- La pantalla necesita una sesión de propietario: el modo demostración no da acceso a esta área.

## Pendiente

- Comparar semanas y ver tendencias.
- Elegir el orden de los profesionales.
