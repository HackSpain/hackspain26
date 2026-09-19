# Pantallas del evento

`/admin/tv` administra pantallas identificadas por URL. Sustituye al editor de cajas
como interfaz de operación. Las tablas y funciones del antiguo canvas se conservan
para no borrar composiciones guardadas, pero `/tv` utiliza vistas predefinidas.

## Conectar y controlar

- Abre `/tv?screen=entrada&view=entradas` en recepción, `/tv?screen=auditorio` en el
  auditorio, etc. El nombre admite 1–48 letras sin acentos, números, guiones o guiones
  bajos y se normaliza a minúsculas.
- Sin `screen`, la URL recibe un identificador `tv-…` automáticamente. Todas las
  pantallas reales se registran; `demo=1` es sólo una preview y no se registra.
- `view` indica la vista inicial de una pantalla nueva. Una configuración guardada
  por el admin siempre tiene prioridad, también después de recargar el navegador.
- En `/admin/tv` se puede preparar un nombre antes de abrirlo, abrir su URL, elegir
  una vista, escribir un aviso y recargar únicamente esa pantalla.
- Puedes borrar una pantalla desconectada y sus conexiones desde su tarjeta. Si se
  vuelve a abrir esa URL, se registrará de nuevo con la configuración inicial.
- Dos navegadores con el mismo nombre comparten contenido y órdenes. El panel avisa
  y lista cada conexión con su URL, resolución y última respuesta. Para controlarlos
  por separado, usa nombres distintos.
- Las órdenes llegan mediante una suscripción pública de Convex a `tvPlayback.screenConfiguration`,
  filtrada por identificador. Sólo los administradores pueden modificarlas.
- Cada navegador comunica presencia mediante `POST /api/tv` cada 15 segundos y al
  recibir una configuración, con timeout de ocho segundos. A los 45 segundos sin
  señal aparece desconectado. La vista conserva su último contenido al perder conexión;
  Convex reanuda la suscripción al reconectar. La respuesta HTTP no aplica órdenes
  en los clientes nuevos, evitando que una respuesta antigua sobrescriba la suscripción.
- El endpoint y la respuesta del heartbeat se mantienen para clientes anteriores:
  despliega backend y frontend, y pulsa recargar en el admin. El cliente antiguo
  recoge la orden por polling y carga la versión con suscripciones sin tocar el PC.
- Las órdenes persisten. El panel indica si todavía están pendientes de recepción;
  esta confirmación no certifica que el monitor físico esté encendido ni que el
  contenido se haya renderizado sin errores.
- La recarga se consume antes de reiniciar y su versión se conserva en sessionStorage,
  por identificador, para evitar bucles. El controlador permanece fuera del boundary
  visual y funciona aunque falle la vista. Un navegador nuevo adopta el estado actual.
- Los registros de conexiones anteriores a 24 horas se limpian cuando la pantalla
  vuelve a comunicar presencia. Los nombres/configuraciones se conservan.
- Mantén el ordenador despierto y el navegador abierto. Una recarga web no puede
  encender un ordenador suspendido, cerrado o apagado.

## Vistas predefinidas

El catálogo compartido está en `convex/lib/tvScreens.ts` y el render en
`src/components/tv/presets.tsx`:

| Vista | Contenido |
| --- | --- |
| `entradas` | Presentaciones de participantes a partir de check-ins reales |
| `avisos` | Un mensaje propio de esa pantalla, hasta 500 caracteres |
| `actividad` | Las últimas publicaciones y eventos de GitHub del feed real |
| `patrocinadores` | Logos del catálogo de patrocinadores existente |
| `espera` | Franjas animadas y marca HackSpain |
| `panel` | Todo el hackathon en una pantalla: cifras, equipos, feed y patrocinadores |
| `equipos` | El mapa de participantes por equipo, en vivo, para la fase de formación |

No hay coordenadas, tamaños de cajas ni métricas simuladas en estas vistas
(salvo la demo del panel, que lo indica en pantalla).
Sólo las funciones admin pueden cambiar contenido y emitir recargas; el heartbeat
público únicamente registra presencia y lee la configuración correspondiente.
Las URLs guardadas sólo incluyen el identificador y la vista, nunca otros parámetros.

## Panel

`/tv?screen=hall&view=panel` reúne lo que ya enseñan las otras vistas, con la
retícula de celdas de color de la landing:

- Cabecera con el tramo del hackathon (24 tramos iguales), la cuenta atrás hasta
  el cierre y la hora de Madrid.
- Una cinta con todos los equipos por tokens y los puestos que han ganado o
  perdido desde que cerró el tramo anterior.
- Cuatro cifras fijas: tokens, pushes, sesiones de agentes y pull requests, cada
  una con su evolución por tramo y lo sumado en el tramo en curso.
- Un tablero que rota cada 12 segundos: pulso del evento, clasificación (siete
  equipos por página, todas las páginas pasan), herramientas de IA y tecnologías.
- El feed (publicaciones y GitHub) baja una fila cada 4,5 segundos y recicla las
  16 últimas; una publicación nueva entra arriba al momento.
- La columna del feed rota en turnos de 10 segundos, con una barra de progreso en
  la cabecera: publicaciones, GitHub y una clasificación individual (primero las
  ocho personas con más tokens; a la vuelta siguiente, las ocho con más pushes y
  pull requests). Cada fila de la clasificación enseña las dos cosas. Una vista sin
  nada que enseñar cede su turno.
- Una cinta de patrocinadores en tinta, como en la landing.

Los datos son los de `/api/tv/insights` (RawTree y Convex, refresco cada 30
segundos) y `tv.listFeed`. Por persona solo sale lo de la clasificación individual:
nombre, foto, equipo, tokens, pushes y pull requests de quienes caben en pantalla; el
consumo del resto no sale del servidor. Los tokens se cruzan por el usuario de la
CLI y GitHub por la cuenta vinculada; un login sin vincular aparece con su login y
sin tokens. Las clasificaciones enseñan la foto de cada persona y el logo de cada
equipo cuando los hay (un login sin vincular, su avatar público de GitHub) y sus
iniciales cuando no; la cinta de equipos solo pone el logo si existe. Las herramientas
de IA y las tecnologías llevan su logotipo desde `public/tv-icons`, que genera
`pnpm icons:tv` (simple-icons y los logos de harness de la landing); hay que volver a
ejecutarlo al ampliar el catálogo de stacks o los harness. Lo que no tiene logotipo
enseña sus iniciales. La rotación se detiene con la pestaña
en segundo plano y respeta movimiento reducido. `/tv?view=panel&demo=1` usa equipos
y cifras inventados (`src/lib/tv-market.ts`), nunca mezclados con los reales.

## Equipos

`/tv?screen=hall&view=equipos` pone a pantalla completa el mapa de `/participantes`
agrupado por equipo, pensado para dejarlo puesto mientras se forman los equipos:

- La gente sin equipo se junta en el centro y los equipos se reparten alrededor.
  Cuando alguien entra en un equipo, su punto cruza el mapa hasta él con un aro
  dorado durante unos segundos; un equipo nuevo aparece en el primer hueco libre.
- Cada equipo conserva su sitio mientras existe, aunque crezca. Sin eso, cada alta
  reordenaría los equipos por tamaño y el mapa entero cambiaría de lugar.
- Cabecera con equipos formados, cuánta gente tiene equipo y cuánta no. Abajo, los
  últimos movimientos ("nuevo equipo" o "se une"). Salir de un equipo no se anuncia.
- Es una suscripción a `tv.teamFormation`, así que los cambios llegan solos. La
  query es pública como el resto de pantallas y sólo publica nombre, foto y equipo;
  el nombre nunca cae a un email. Incluye a quien tiene la ficha completa o ya está
  en un equipo.
- No responde al ratón ni al teclado: es una pantalla, no el mapa interactivo.

`/tv?view=equipos&demo=1` forma equipos con 96 personas inventadas, una cada dos
segundos, y vuelve a empezar (`src/lib/tv-teams.ts`). El modo en vivo del mapa
(`live` en `network-canvas.tsx`) no cambia el comportamiento de `/participantes`.

## Entradas y tamaños de pantalla

El contenido ocupa todo el viewport, sin un lienzo fijo de 1920 × 1080 ni barras
para conservar 16:9. La foto, tipografía y datos se adaptan al ancho y alto; en
vertical la foto queda arriba y la ficha debajo.

Cada persona permanece completamente visible durante **3 segundos**, además de
1,1 segundos de entrada y 0,9 de salida (5 segundos por turno). Se presentan foto,
nombre, rol, ciudad, empresa, universidad y hasta tres especialidades según su perfil.
Los campos vacíos no se muestran; sin foto aparecen sus iniciales. Las franjas cubren
el cambio y siguen en bucle si no hay entradas pendientes. Respeta movimiento reducido.

La antigua estación web de recepción está retirada: su página responde 404 y
`/api/reception` responde 410. Sus operaciones de Convex son internas. La proyección
`passes.arrivals` se conserva para la pantalla de entradas y no publica emails,
teléfonos ni códigos de acreditación.

`/tv?view=entradas&demo=1` reproduce ejemplos sin consultar entradas ni hacer check-ins.
La foto/cargo de Mark Villacampa son públicos; los demás perfiles son ficticios.
También puede previsualizarse cualquier otra vista con `view=…&demo=1`.

## Despliegue

Publica el esquema con `tvScreens` y `tvScreenConnections`, las funciones nuevas de
`tvPlayback`, `passes.arrivals` y el frontend. No requiere migrar las composiciones
antiguas: cada pantalla se registra al abrir su URL. Las pantallas que sigan ejecutando
la web anterior necesitan una recarga inicial para usar el registro y control nuevo.

### Retirada de los metadatos antiguos

Si la base de datos ya contiene `checkedInBy` o `checkedInVia`, hay que retirarlos
antes de desplegar el esquema que los elimina: publicar primero
`migrations.dropCheckInMetadata` y el nuevo `passes.ts` conservando ambos campos
opcionales en el esquema anterior, ejecutar `migrations:dropCheckInMetadata` en
ese mismo despliegue y después publicar el esquema final. La migración es interna,
idempotente y conserva el código, la vinculación al participante y `checkedInAt`.
En una base sin esos campos se puede publicar directamente el esquema final.
