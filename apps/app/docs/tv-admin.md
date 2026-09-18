# Venue TV administration

`/admin/tv` builds on the existing canvas and saved layouts. Saved screens are in a left sidebar; editing and publishing are separate actions. Saving changes to the currently live layout updates the venue screens.

- Restore defaults loads the aggregate Insights composition without team leaderboards. It saves a recovery copy of the working canvas and preserves the published layout.
- Text sizes accept 8–240 reference pixels on a 1920px canvas, scaling with the display. Existing semantic presets retain their rendering until edited. Geometry accepts decimal percentages.
- Insights widgets still use demo data. Do not present them as live telemetry or add private participant data to this public screen.
- `/tv` consumes the existing public layout through Convex subscriptions and a `/api/tv` HTTP fallback every 20 seconds. It retains the last snapshot in memory through connection failures.
- Remote reload increments a version consumed once per tab, persisted before reloading. The recovery controller is outside widget rendering errors. There is no per-screen delivery acknowledgement or classroom inventory.
- Venue computers must stay awake with their browser open; JavaScript cannot recover suspended or closed browsers.

This feature does not introduce registration, access codes, reception routes, check-in, or participant access gates.

## Pantalla de entrada (1920 × 1080)

Abre `/tv?view=entradas` en el monitor de recepción; el botón «Abrir pantalla de
bienvenida» de la estación de check-in lleva a esa vista. Pasa el ratón por la
esquina inferior derecha para activar pantalla completa. El lienzo conserva 16:9.

Cada check-in nuevo (desde recepción o administración) presenta al participante
10 segundos, incluidas las transiciones de franjas verticales de color, con nombre,
foto, rol, ciudad, empresa y universidad en campos separados, y hasta tres
especialidades, según los datos de su perfil. Los campos vacíos no se muestran. Si no tiene foto se muestran sus iniciales. No se
publican emails, teléfonos ni códigos de acreditación. Las entradas simultáneas
se encolan; escanear dos veces un pase no repite la presentación. Deshacer una
entrada la retira de la cola. Al abrir o recargar se empieza desde ese momento,
sin reproducir las entradas anteriores; una reconexión de la misma página sí
recupera las entradas pendientes. Las franjas de color cubren el cambio entre
personas y siguen moviéndose mientras la cola está vacía; no hay pantallas de texto intermedias.

`/tv?view=entradas&demo=1` reproduce ejemplos y la pantalla de espera (la foto y
el cargo de Mark Villacampa vienen de la web pública; los otros perfiles son ficticios),
sin consultar entradas ni hacer check-ins. Respeta movimiento reducido. Hay que
publicar la función Convex `passes.arrivals` junto con el frontend.

### Conexión con recepción

Abre primero `/tv?view=entradas` (sin `demo=1`) en el monitor y usa la URL de
recepción en las dos mesas. Al validar los cuatro caracteres, `passes.staffScan`
guarda `eventPasses.checkedInAt`. La suscripción `passes.arrivals` transmite la
entrada al monitor, que carga los datos del perfil y la presenta automáticamente,
sin recargar ni pulsar nada en la TV. Si está libre, sale al recibir el cambio;
si ya está presentando a alguien, espera su turno. No se almacena el operador ni
el canal de entrada. Los códigos incorrectos y los pases ya registrados no generan
una nueva presentación.

### Retirada de los metadatos antiguos

Si la base de datos ya contiene `checkedInBy` o `checkedInVia`, hay que retirarlos
antes de desplegar el esquema que los elimina: publicar primero
`migrations.dropCheckInMetadata` y el nuevo `passes.ts` conservando ambos campos
opcionales en el esquema anterior, ejecutar `migrations:dropCheckInMetadata` en
ese mismo despliegue y después publicar el esquema final. La migración es interna,
idempotente y conserva el código, la vinculación al participante y `checkedInAt`.
En una base sin esos campos se puede publicar directamente el esquema final.
