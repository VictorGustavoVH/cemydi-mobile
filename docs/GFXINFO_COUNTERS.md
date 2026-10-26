# Procedencia de contadores duplicados de gfxinfo

## Diagnóstico inicial del 26 de octubre de 2026

Se revisaron parser, pruebas y JSON locales sin ejecutar comandos Android ni
capturas de rendimiento. Esta sección conserva la investigación inicial; la regla
actual basada en la inspección posterior se documenta más abajo.

En `2026-10-26T06-35-51-813Z-capture-3cd14bdf` se verificaron cuatro muestras con dos
coincidencias de total y jank, un encabezado de proceso y valores `[18,18]`/`[6,6]`.
En `2026-10-26T06-37-17-663Z-capture-be964d86` hay 90 muestras con duplicados;
la primera conserva `[19,19]`/`[7,7]`. No se modificaron esos archivos.

`processSections=1` cuenta encabezados de proceso, no ventanas ni bloques de
estadísticas. Las expresiones regulares buscaban etiquetas en todo el texto sin
conservar su posición frente a encabezados. Los arrays de números no permiten
deducir si proceden de distintas secciones ni demuestran equivalencia.

## Explicación fundada en AOSP Android 10

El código de referencia imprime datos globales en
[RenderThread::dumpGraphicsMemory](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android10-release/libs/hwui/renderthread/RenderThread.cpp)
y estadísticas y frames de ventana en
[CanvasContext::dumpFrames](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android10-release/libs/hwui/renderthread/CanvasContext.cpp).
[JankTracker](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android10-release/libs/hwui/JankTracker.cpp)
actualiza datos locales y globales y puede emitir el marcador `Window:`.

En la investigación inicial, global + ventana era una hipótesis sin marcadores
reales conservados. La nueva evidencia proporcionada por el operador separa ambas
regiones. Una ventana puede tener totales iguales a los globales en un momento y
diferentes después. No se suman ni se deduplican por igualdad.

## Diagnóstico de estructura y límites iniciales

`metrics.cjs` añade `diagnostics.structure`: eventos con número de línea, marcador
normalizado, índice de proceso/sección y bloque `Stats since`, más valores enteros/null
de las dos etiquetas. No exporta líneas originales, nombres de ventanas, paquetes,
títulos, identificadores de vista ni texto arbitrario.

Reconoce proceso, `Profile data in ms:`, `Window:`, `Package:`, `Pipeline=`,
`Stats since:`, límites `---PROFILEDATA---`, cabecera de frames y `View hierarchy:`.
Los encabezados desconocidos terminados en dos puntos se representan como
`unknown-header`, sin contenido. Otros textos se omiten.

`region` indica el marcador anterior reconocido, **no propiedad semántica demostrada**;
`ownership=unverified` lo explicita. Los índices son ordinales dentro del dump, no
identifican la misma ventana entre consultas. El escáner no cubre cualquier formato
OEM ni recupera la estructura perdida en reportes históricos.

En esa fase no se añadió un selector para resolver duplicados. Se cerró un emparejamiento inseguro:
un único total y un único jank de procesos/secciones/bloques distintos no forman un
par válido. Para conservar la aceptación anterior de un par único, ambos deben
pertenecer al mismo bloque reconocido del único proceso. Formatos desconocidos o
ambiguos quedan **No medible**. La cobertura de frames sigue evaluándose por separado.

Las pruebas cubren global/ventana con valores iguales y distintos, duplicados dentro
de un bloque, pares repartidos entre procesos/ventanas/bloques, formato desconocido,
CRLF, redacción de datos e inspección aislada con ADB simulado.

## Inspección manual mínima

Mantener dispositivo dedicado, sin datos personales, modo avión, Wi-Fi apagado y
ninguna conexión de red activa. No abrir, cerrar ni navegar la app para inspeccionarla.
Si no está ejecutándose, informar falta de reporte: la herramienta no la inicia.

Desde la raíz del repositorio, ejecutar manualmente una vez:

```powershell
node scripts/performance/inspect-gfxinfo.cjs --device SLVNW20819004312
if ($LASTEXITCODE -ne 0) { throw 'Inspección no validada; revisar el error técnico.' }
```

Verifica dispositivo explícito y aislamiento y hace una sola consulta
`dumpsys gfxinfo com.cemydi.app framestats`, sin reset. La salida original vive solo
en memoria. La consola muestra JSON redactado de contadores/estructura; no crea
archivos ni ejecuta el runner de rendimiento. No usa logcat, screenshots ni jerarquías
UI. No redirigir dumps completos ni filtrar líneas que conserven títulos de ventanas.

Código 0 significa inspección disponible, no aprobación de métricas. Con la regla
actual, dos pares global/ventana pueden producir `counters.status=measured` para la
única ventana identificada; duplicados dentro de la ventana siguen No medible. Fallos ADB,
aislamiento, proceso no único o etiquetas no reconocidas se comunican como error sin
copiar stderr privado. Se puede compartir el JSON redactado, no el dump original.

Revisar `diagnostics.structure.events`:

1. Ubicar `process-header` y cada `total-counter`/`janky-counter` por número de línea.
2. Un par en `process-preamble` y otro después de `window-header` confirma regiones
   impresas distintas y apoya la hipótesis global/ventana; falta verificar cuál es
   apropiado para la métrica y cómo se vincula con sus frames.
3. Si ambos pares comparten sección/bloque, siguen duplicados en ese contexto.
4. Si aparece `unknown` o faltan marcadores, mantener No medible y ampliar únicamente
   el diagnóstico mediante marcadores explícitos redactados.

La inspección nueva permite aplicar la regla de ventana siguiente. El escáner genérico
continúa con `ownership=unverified`: describe marcadores. La validación semántica se
consulta por separado en `diagnostics.windowSelection` y en `source`; nunca se
convierten arrays de valores repetidos en una métrica por su igualdad.

## Regla actual: una ventana y su framestats

Evidencia real proporcionada por el operador, sin repetir comandos Android aquí:

| Alcance impreso             | Bloque       | Total        | Janky       |
| --------------------------- | ------------ | ------------ | ----------- |
| process-preamble, proceso 1 | statsBlock 1 | línea 7: 20  | línea 8: 8  |
| window, proceso 1           | statsBlock 2 | línea 51: 20 | línea 52: 8 |

Después del segundo par están los límites de framestats en líneas 66/78 y su
cabecera en línea 67. Son contadores acumulados: no se calcula un porcentaje del
recorrido a partir de este único snapshot.

En Android 10, `CanvasContext::dumpFrames` llama a `mJankTracker.dumpStats(fd)` y
después a `mJankTracker.dumpFrames(fd)`: las estadísticas de ventana y la tabla
posterior pertenecen al mismo tracker. `JankTracker` imprime `Window:` para ese tipo
y delimita su tabla con `---PROFILEDATA---`. La región de preámbulo corresponde al
alcance global; no se usa como sustituto de la ventana. Estas relaciones de AOSP,
junto con la secuencia observada, justifican reconocer el bloque window seguido de
su tabla. No se exige que sus valores coincidan con el preámbulo.

El parser exige, sin seleccionar ventanas por orden:

1. Un solo proceso, un solo `Profile data in ms:`, una sola `Window:` con identidad
   no vacía, una tabla delimitada por dos límites y una cabecera de frames.
2. Orden proceso, profile, ventana, apertura, cabecera, cierre; dentro de la ventana,
   un solo `Stats since: <entero positivo>ns` seguido de un total y un janky válidos.
   El par pertenece a la misma región/sección/bloque lógico. No hay otros marcadores
   interpuestos ni contadores después de empezar la tabla.
3. Contadores globales ignorados para calcular: no se suman y no hay fallback global.
   Varias ventanas, pares duplicados en la ventana, formato distinto o datos
   incompletos dejan No medible. Dos ventanas con nombres iguales también se rechazan.

La tabla se parsea exclusivamente entre los límites asociados. La cabecera debe
identificar sin duplicados Flags, IntendedVsync y FrameCompleted para tener tiempos
válidos. Los fallos de filas/cabecera afectan cobertura, sin convertir un contador
de ventana válido en un contador global.

## Continuidad e identidad privada

El runner crea una clave HMAC aleatoria por captura y la usa para todas sus muestras.
Solo persiste el HMAC-SHA256 del nombre completo de `Window:`, nunca el nombre ni la
clave. La inspección aislada usa una clave efímera de su proceso Node. Los tokens no
son comparables entre capturas ni sirven para identificar una ventana histórica.

Antes de calcular variaciones, `frameSummary` exige mismo PID, formato de fuente,
región window, índices de proceso/sección/bloque, HMAC de ventana, `Stats since` y
región de tabla. Un cambio en cualquier muestra invalida el intervalo, aunque luego
vuelva el valor original. También se rechazan contadores decrecientes y aumentos
janky mayores que el aumento total. La época detecta reinicios incluso si el nuevo
contador ya supera al anterior.

Esta identidad comprueba continuidad del nombre impreso y de la época, no es un ID
nativo de Surface. Un título cambiante, otra ventana, cambios de layout del reporte
o una recreación harán la validación conservadora. No se intenta rastrear ventanas
múltiples ni reconstruir reinicios ocurridos íntegramente entre muestras sin señal
observable. Si el firmware reutiliza nombre y época sin evidenciar la recreación,
ADB por sí solo no la puede demostrar.

## Métricas habilitadas y pendientes

| Métrica                                                   | Condición                                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Delta de frames y janky de una ventana                    | Snapshot inicial y final y muestras intermedias con continuidad verificada; delta total > 0                        |
| Jank de ventana                                           | 100 × delta janky / delta total; no es porcentaje de frames lentos                                                 |
| Frames lentos >16.667 ms y congelados >700 ms             | Además, filas válidas Flags=0 del mismo bloque, sin duplicados ni frames iniciales; cobertura completa verificable |
| FPS, GPU, TTID/TTFD, fluidez JS, cobertura de toda la app | No calculados por esta corrección                                                                                  |

La cobertura sigue siendo independiente: número de frames únicos nuevos igual al
delta total y ninguna fila inválida, incluida la muestra inicial. Un buffer parcial
permite jank por contadores, pero lentos/congelados quedan No medible. Cero frames
nuevos no se interpreta como cero jank. Nada aprueba por sí solo el criterio global.

La captura usa ahora protocolo 3. Se rechazan comparaciones mezcladas con protocolos
1/2; no se reprocesan ni sobrescriben sus reportes. La evidencia estructural antigua
no conserva nombre/época para comprobar continuidad retrospectivamente. La regla está
probada con fixtures redactados: uno conserva las posiciones/valores de contadores
y límites informados; identidad, época, contexto restante y filas son sintéticos.
No representa nuevas mediciones del dispositivo.

## Futura prueba gráfica controlada

Comandos preparados, **no ejecutados**. Tras autorización de la captura y de la
preparación manual de la app, mantener Preview sin Metro, sesión invitada, modo avión,
Wi-Fi desactivado y ninguna red activa. Conservar una única ventana y acordar un
recorrido local de scroll reproducible; no abrir teclado/sheets durante esta prueba.
Si no existe contenido local que pueda dibujarse/desplazarse, marcar skipped.

```powershell
$perfDevice = 'SLVNW20819004312'
$perfConfigDir = Join-Path 'test-results/performance' ('gfx-window-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $perfConfigDir
$perfConditions = Join-Path $perfConfigDir 'conditions.json'
Copy-Item scripts/performance/conditions.example.json $perfConditions
notepad $perfConditions
```

Editar esa copia a `initialState=foreground` y demás condiciones reales. Con la app
preparada manualmente, sin lanzamiento automático:

```powershell
npm run performance -- capture --device $perfDevice --authorize $perfDevice --scenario PERF-01 --conditions $perfConditions --repeat 3 --duration 30 --interval 1 --settle 15
```

En cada repetición comprobar `graphicsBefore.source` y las fuentes de todas las
muestras: una ventana, misma identidad/época; `graphics.value.source` conserva el
alcance del resumen válido. Ver también `diagnostics.windowSelection` para el motivo
de rechazo. El sobrecosto ADB modifica el intervalo efectivo y el buffer puede perder
frames: no se garantiza cobertura completa con intervalo de 1 s. Esta prueba separada
caracteriza renderizado al interactuar, no tiempo de inicio.

## Validación local sin dispositivo

```powershell
npm run typecheck
npm run lint
npm run format:check
node --test scripts/performance/performance.test.cjs scripts/maestro-infra.test.cjs
```

Resultado de esta revisión: TypeScript, ESLint y Prettier aprobados; 28 pruebas de
rendimiento/diagnóstico y 6 de infraestructura Maestro aprobadas (34 en total).
Se verificó el mismo SHA-256 agregado del árbol histórico antes y después:
`95182427920f66d188d4dde66db6c617e602b960e8b3044f89fa2a2aa0cb9713`.
Este resultado corresponde a la fase de inspección inicial. La validación nativa de
la regla de ventana y cualquier medición nueva continúan pendientes de autorización.

Validación de la regla de ventana: TypeScript, ESLint y Prettier aprobados;
37 pruebas de rendimiento/diagnóstico y 6 de infraestructura Maestro aprobadas
(43 en total). El hash histórico anterior se verificó idéntico antes y después de
esta corrección. No se ejecutaron comandos Android, instalaciones ni capturas.
