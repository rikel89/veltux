# Sprint 5 · Reserva pública con verificación por SMS

## Historias de usuario y criterios de aceptación

### H1 · Encontrar a mi profesional (cliente)
- [x] `/{salón}` lista los profesionales que aceptan reservas online, con licencia y en un establecimiento activo o en prueba.
- [x] `/{salón}/{profesional}` muestra su presentación y sus servicios públicos con duración y precio.
- [x] Una dirección inexistente muestra una página «No encontramos esta página» en castellano.

### H2 · Elegir hora (cliente)
- [x] Días desde hoy hasta el horizonte del profesional (máx. 21 visibles) y horas libres agrupadas en mañana, tarde y noche.
- [x] Las horas salen de `get_available_slots`: respetan horario, excepciones, citas, margen, **antelación mínima** y **horizonte**.

### H3 · Confirmar con un código por SMS (cliente)
- [x] Nombre, teléfono (se normaliza a +34), email y comentario opcionales.
- [x] Código de 6 cifras con aleatoriedad criptográfica; se guarda solo su hash (bcrypt) y caduca a los 10 minutos.
- [x] Límites en PostgreSQL: 3 códigos por teléfono cada 15 min, 10 por IP cada hora, 5 intentos por código.
- [x] Código correcto → la cita se crea en la misma transacción; si la hora acaba de ocuparse se pide otra sin gastar el código.
- [x] Pantalla final «Reserva confirmada» solo cuando la cita existe de verdad.

### H4 · El cliente llega a mi cartera (profesional)
- [x] Si ya existía un cliente con ese teléfono (aunque estuviera archivado) se reutiliza; si no, se crea con el teléfono verificado.
- [x] La cita aparece en *Mi agenda* con origen `public_portal`.

### H5 · Controlar cuándo me reservan (profesional)
- [x] *Mi perfil*: antelación mínima (sin antelación … 2 días) y horizonte (7 … 180 días), y enlace a «Ver mi página de reservas».

## Seguridad

- `request_booking_otp` y `create_public_booking` solo las ejecuta `service_role` (el servidor de la app); el navegador no puede llamarlas ni leer `booking_otps`.
- Las escrituras de la API pública exigen `Origin` igual al host (CSRF).
- La IP no se guarda: solo un HMAC truncado para los límites.
- La página pública usa un cliente anónimo sin cookies: nunca actúa con la sesión de quien la visita.
- Un código incorrecto devuelve `null` en lugar de error para que el intento fallido quede registrado.

## SMS

`src/lib/sms` define la interfaz `SmsSender`.

| Entorno | Comportamiento |
| --- | --- |
| Desarrollo (`next dev`) | El código se escribe en la consola del servidor: `[SMS simulado] → +34…` |
| Producción sin proveedor | `getSmsSender()` devuelve `null`: la página avisa de que la reserva online no está activa |
| Producción con proveedor | Pendiente de elegir proveedor (Sprint 6) |

## Migración

`supabase/migrations/20261106090000_sprint5_public_booking.sql`

| Objeto | Qué |
| --- | --- |
| `professionals.min_notice_minutes`, `booking_horizon_days` | Ajustes de reserva (por defecto 2 h y 60 días) |
| `booking_otps` | Códigos (hash), intentos, caducidad, huella de IP |
| `request_booking_otp()` | Genera el código con límites de abuso |
| `create_public_booking()` | Verifica y reserva en una transacción |
| `get_available_slots()` | El público respeta antelación y horizonte |
| `get_public_salon()` | Añade color y ajustes de reserva |

## Pruebas

- `tests/db/public-booking.test.ts`: 12 pruebas (permisos, flujo completo, código incorrecto/caducado/bloqueado, reutilización de cliente, huecos no válidos, servicios privados, límites por teléfono e IP, horizonte).
- `tests/unit/booking.test.ts`: días, agrupación, validación, origen, huella de IP y SMS nunca simulado en producción.
- `tests/e2e/public-booking.spec.ts`: 404 sin Supabase, origen rechazado, validación de la API.
- Total: 167 Vitest y 29 Playwright.

## Pendiente

- Elegir proveedor de SMS y conectarlo.
- Enlace para que el cliente cancele su cita (Sprint 6).
- Reordenar profesionales y servicios de la página pública.
