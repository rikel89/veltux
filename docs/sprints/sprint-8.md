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

## Migración

`supabase/migrations/20261109090000_sprint8_platform_stats.sql`: `admin_platform_stats(integer)`.

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

Ver `/admin/configuracion`. Decisiones abiertas: proveedor de SMS, tarea programada, SMTP propio y textos legales.
