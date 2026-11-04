# Sprint 8 · Pruebas y piloto real

## Historias de usuario y criterios de aceptación

### H1 · Reservas simultáneas (cliente y profesional)
- [x] Veinte citas a la vez al mismo hueco: solo se crea una.
- [x] Agenda y reserva online compitiendo: gana solo una. Quien pierde no deja clientes huérfanos.
- [x] Las citas que se pisan en parte nunca quedan solapadas, y dos citas no se mueven al mismo hueco.

### H2 · Límites bajo carga (plataforma)
- [x] Las invitaciones simultáneas no superan las licencias contratadas.
- [x] Las peticiones simultáneas de códigos respetan el límite por teléfono.
- [x] Probar códigos en paralelo no da más de 5 intentos, y un código correcto no sirve dos veces.
- [x] Varios procesos de la cola nunca reclaman el mismo mensaje.

### H3 · Estadísticas (administrador)
- [x] `/admin/estadisticas`: citas, reservas online, resultado de las citas, notificaciones y uso por establecimiento, en 7, 30 o 90 días.
- [x] Solo cifras agregadas: el administrador sigue sin poder leer clientes ni citas.

### H4 · Preparar el piloto (administrador)
- [x] `/admin/configuracion`: lista de comprobación con lo configurado, lo pendiente y lo que hay que revisar a mano. Nunca muestra valores de claves.

### H5 · Errores y cabeceras
- [x] Página de error en castellano con una referencia, sin detalles técnicos.
- [x] Cabeceras de seguridad. `Referrer-Policy` evita que el enlace firmado de `/cita` se filtre a otras webs.

### H6 · Reservar y recibir avisos por email (cliente)
- [x] La reserva pide nombre, teléfono y email, y un código de 6 cifras enviado por correo. Sin coste de mensajería.
- [x] El código verifica el email, no el teléfono: una reserva nunca cambia los datos de una ficha existente, y cada cita guarda su email de contacto.
- [x] Límites: 3 códigos por email cada 15 minutos, 10 por IP cada hora, 5 intentos por código y 3 citas futuras por email o teléfono con cada profesional.
- [x] Confirmación, cancelación, cambios y propuestas salen al momento. Recordatorios y reintentos, con la tarea diaria de Vercel: el recordatorio llega entre 0 y 24 h antes.
- [x] Sin email en la ficha ni en la cita no se encola nada. Sin proveedor los mensajes siguen pendientes y, en producción, la reserva online se desactiva.

## Variables del correo

| Variable | Dónde | Qué |
| --- | --- | --- |
| `BREVO_API_KEY` | `.env.local` y Vercel | Clave de API de Brevo (secreta) |
| `EMAIL_FROM_ADDRESS` | `.env.local` y Vercel | Remitente verificado en Brevo |
| `EMAIL_FROM_NAME` | Opcional | Por defecto, VELTUX |
| `CRON_SECRET` | Vercel | Protege la tarea diaria de `vercel.json` |

Sin clave de Brevo, en desarrollo el correo se escribe en la consola del servidor como `[Email simulado]`.

## Migración

- `supabase/migrations/20261109090000_sprint8_platform_stats.sql`: `admin_platform_stats(integer)`.
- `supabase/migrations/20261110090000_email_channel.sql`: código y avisos por email.

## Pruebas

```bash
npm run test:concurrency
```

- `tests/concurrency/concurrency.test.ts`: 10 pruebas con **PostgreSQL real** (`embedded-postgres`) y una conexión por petición. No necesita Docker.
- `tests/db/platform.test.ts`: 4 pruebas de estadísticas y privacidad.
- `tests/unit/readiness.test.ts`: lista de comprobación.

## Limitaciones conocidas

- Las pruebas de concurrencia solo se han ejecutado en Windows y no están en CI: `embedded-postgres` es una versión beta y en Linux depende de un script de instalación.
- Los flujos con sesión no tienen E2E automático: necesitan un Supabase local (Docker) o un proyecto de pruebas aparte. Producción y local comparten hoy la misma base de datos.
- Sin política de seguridad de contenido (CSP): queda por definir.

## Antes del piloto

Ver `/admin/configuracion`. Pendiente: cuenta de Brevo, `CRON_SECRET`, SMTP de las invitaciones y textos legales. El aviso de entrega de Brevo aún no está conectado: los mensajes llegan a «Enviada», no a «Entregada».
