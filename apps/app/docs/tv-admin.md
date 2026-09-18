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
- En `/admin/tv` se puede preparar un nombre antes de abrirlo, copiar su URL, elegir
  una vista, escribir un aviso y recargar únicamente esa pantalla.
- Dos navegadores con el mismo nombre comparten contenido y órdenes. El panel avisa
  y lista cada conexión con su URL, resolución y última respuesta. Para controlarlos
  por separado, usa nombres distintos.
- Cada navegador comunica presencia y recibe órdenes mediante `POST /api/tv` cada
  tres segundos, con timeout de ocho segundos. A los veinte segundos sin respuesta
  aparece desconectado. Se conserva la última vista durante un fallo de conexión.
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

No hay coordenadas, tamaños de cajas ni métricas simuladas en estas vistas.
Sólo las funciones admin pueden cambiar contenido y emitir recargas; el heartbeat
público únicamente registra presencia y lee la configuración correspondiente.
Las URLs guardadas sólo incluyen el identificador y la vista, nunca otros parámetros.

## Entradas y tamaños de pantalla

El contenido ocupa todo el viewport, sin un lienzo fijo de 1920 × 1080 ni barras
para conservar 16:9. La foto, tipografía y datos se adaptan al ancho y alto; en
vertical la foto queda arriba y la ficha debajo.

Cada persona permanece completamente visible durante **3 segundos**, además de
1,1 segundos de entrada y 0,9 de salida (5 segundos por turno). Se presentan foto,
nombre, rol, ciudad, empresa, universidad y hasta tres especialidades según su perfil.
Los campos vacíos no se muestran; sin foto aparecen sus iniciales. Las franjas cubren
el cambio y siguen en bucle si no hay entradas pendientes. Respeta movimiento reducido.

Abre la pantalla **antes** de validar el código en recepción. `passes.staffScan`
guarda `checkedInAt` y `passes.arrivals` transmite la entrada al monitor, sin recargas
ni acciones adicionales allí. Entradas simultáneas se encolan; repetir el código no
repite la presentación. Deshacer una entrada la retira. Al abrir o recargar se empieza
desde ese momento; la reconexión de la misma vista recupera entradas pendientes.
No se publican emails, teléfonos ni códigos de acreditación.

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
