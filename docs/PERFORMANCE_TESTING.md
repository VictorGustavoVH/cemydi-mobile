# Pruebas de rendimiento Android

La investigación de contadores duplicados y su inspección redactada están en
[GFXINFO_COUNTERS.md](./GFXINFO_COUNTERS.md).

## Objetivo y alcance

Preparar evidencia reproducible para la Actividad 4, comparar recorridos reales con
una línea base y distinguir resultados de objetivos. Solo infraestructura Node/ADB:
sin cambios de UI, backend, Google Sign-In, dependencias, firmas, identificador ni
workflows Quality/Tests. No se ejecuta carga HTTP ni se instala software.

Implementación: `scripts/performance/cli.cjs`, `metrics.cjs`,
`performance.test.cjs` y `conditions.example.json`. Node usa APIs nativas;
ADB debe existir en PATH o indicarse con `CEMYDI_ADB` (ruta a ejecutable).

## Diagnóstico ejecutado

Diagnóstico de solo lectura el **25 de octubre de 2026**, hora de México
(evidencia UTC: `2026-10-26T04:58:16.942Z`). No se abrió, cerró ni reemplazó la app.

| Elemento                    | Observación real                                              |
| --------------------------- | ------------------------------------------------------------- |
| Dispositivo                 | HUAWEI STK-LX3; ADB conectado/autorizado                      |
| Android                     | 10, API 29                                                    |
| Hardware/ABI                | kirin710; arm64-v8a, armeabi-v7a, armeabi                     |
| RAM física expuesta         | MemTotal 5 826 412 kB; no es PSS de la app                    |
| Pantalla                    | 1080 x 2340, densidad 480                                     |
| App instalada               | com.cemydi.app; versionName 1.0.0, versionCode 1              |
| Build instalada             | DEBUGGABLE, con expo.modules.devlauncher: Development Build   |
| Host                        | Windows, Node 24.11.0, ADB 1.0.41 / platform-tools 37.0.0     |
| Dependencias instaladas     | Expo 57.0.31, React Native 0.86.3                             |
| SDK Android disponible      | platform-tools, build-tools, emulator, platforms, NDK, CMake  |
| Maestro                     | Distribución local en .tools/maestro; cinco flujos existentes |
| Configuración Expo resuelta | SDK 57.0.0, app 1.0.0, com.cemydi.app, plugins CNG existentes |

La primera inspección encontró `test/e2e-maestro-android`; una lectura posterior
encontró `develop`. La herramienta registra rama/commit/estado sucio en cada
ejecución. No se ejecutaron operaciones de cambio de rama ni de publicación.

`eas.json`: development usa developmentClient; preview usa developmentClient=false,
distribución interna y APK. Preview declara APP_ENV=production: **esto no prueba
aislamiento de red ni certifica qué APK está instalado**. La configuración Expo se
consultó mediante `@expo/config`, mostrando únicamente campos permitidos, sin copiar
variables de entorno. No hay carpetas nativas versionadas; se conserva CNG.

Evidencia local ignorada:
`test-results/performance/2026-10-26T04-58-16-608Z-diagnose-794ea9ba/`.
Contiene metadata y tiempos técnicos; no contiene mediciones de rendimiento.

## Build requerida y seguridad de los recorridos

Se necesita una build preview/release con bundle JS incorporado, sin DEBUGGABLE
ni Expo Dev Launcher, sin Metro. No generar ni instalar un APK sin autorización.
El diagnóstico reconoce compatibilidad release; no puede distinguir preview de
producción solamente con PackageManager. Conservar aparte procedencia EAS y hash
SHA-256 del APK aprobado. `lastUpdateTime`, versión y dispositivo se usan para
rechazar comparaciones entre instalaciones distintas; no equivalen al hash del APK.

Las capturas requieren `--authorize` igual al serial, más `ready` por repetición.
Esto expresa autorización del operador al invocar el comando; no autoriza al agente
a iniciarlo por su cuenta. Antes de ejecutarlo: dispositivo dedicado, sesión invitada,
sin cuentas reales y sin datos personales. No cerrar sesión, limpiar datos ni
desinstalar automáticamente. Si hay sesión real, detener la preparación y resolver
manualmente el entorno de pruebas con autorización.

La única modalidad implementada es **offline**: activar modo avión, desactivar
Wi-Fi y desconectar Ethernet/tethering/Bluetooth de red manualmente. El preflight y
cada muestra exigen modo avión=1, Wi-Fi=0 y `Active default network: none/null`.
Si el fabricante cambia ese formato, se bloquea; no se omite el fallo. Mantener el
aislamiento durante toda la sesión: las verificaciones periódicas no sustituyen
la desconexión física/lógica entre muestras. La herramienta no cambia radios.

El catálogo actual depende de API y sus fixtures no son fallback. Sin datos
sintéticos locales disponibles en una build aprobada, PERF-02 a PERF-05 quedan
**pendientes/no ejecutables**, no aprobados por mostrar pantallas vacías. No conectar
producción para poblar la caché. Una futura build dirigida a una API ficticia aislada
requiere autorización y verificación propias; este trabajo no la genera.

Los selectores y pasos de `.maestro/catalog.yaml`, `product-detail.yaml` y
`cart.yaml` sirven como referencia del recorrido. No se invoca Maestro: los flujos
actuales usan `support/open-app.yaml` con limpieza y un Development Build/Metro.
No ejecutar el runner E2E para medir rendimiento. No hay taps por coordenadas.

## Metodología y escenarios

Antes de la línea base: acordar mismo APK, equipo, orientación, animaciones por
defecto, brillo, batería, carga, temperatura, caché y datos sintéticos. Dejar enfriar
el equipo y registrar condiciones sin texto libre. No mezclar caché caliente/fría.
Hacer una primera ejecución completa de referencia por escenario (tres repeticiones)
y otra candidata con las mismas condiciones; conservar ambas sin sobrescribirlas.

Por defecto: tres repeticiones, 60 s de recorrido, muestras cada 5 s y 15 s finales
de estabilización. PERF-05: usar 120 s y 30 s de estabilización, cinco ciclos por
repetición. Los tiempos reales de ADB aumentan el intervalo; se guardan tiempos
monotónicos reales, no se supone periodicidad exacta. Los dumps tienen sobrecosto.

| Escenario        | Estado inicial y acciones manuales                                                                                                       | Punto final          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| PERF-01 Inicio   | Registrar foreground/background/not-running; abrir normalmente. ADB opcional con --launch yes                                            | Inicio estable       |
| PERF-02 Catálogo | Inicio con datos sintéticos; Explorar, 3 desplazamientos, buscar mismo término sintético, borrar búsqueda, aplicar/quitar disponibilidad | Catálogo sin filtros |
| PERF-03 Detalle  | Catálogo; mismo producto, descripción, 3 desplazamientos, características, volver                                                        | Catálogo             |
| PERF-04 Carrito  | Invitado; mismo producto sintético, añadir, aumentar/reducir cantidad, volver                                                            | Inicio               |
| PERF-05 Repetida | Inicio; 5 ciclos Inicio, Explorar, Detalle, Carrito, Inicio                                                                              | Inicio estable       |
| PERF-06 Local    | Invitado, foreground, Ayuda y contacto desde Inicio; 3 desplazamientos verticales y regresar arriba                                      | Ayuda al inicio      |

Preparar manualmente el mismo punto inicial antes de cada `ready`; conservar igual
cantidad de productos en carrito. Si no puede reproducirse sin borrar datos, detener
y documentar la limitación. Responder `completed` solo si se cubrió todo el recorrido;
`skipped` si faltan datos; `crash` ante cierre inesperado; `error` ante otro fallo.
No introducir nombres, mensajes privados ni credenciales en terminal.

PERF-01 no fuerza cierres. `am start -W` no implica inicio frío: puede reutilizar
actividad/proceso. Warnings de entrega a actividad existente invalidan TotalTime.
Con proceso inicialmente ausente se admite medir memoria posterior, pero estadísticas
gráficas del intervalo quedan No medible sin contadores iniciales. Registrar y
comparar estados de lanzamiento iguales. La herramienta no instrumenta tiempo
hasta contenido interactivo ni carga remota.

## Comandos PowerShell en Windows 11

Desde la raíz del repositorio, diagnóstico permitido sin interacción con la app:

```powershell
$perfDevice = 'SLVNW20819004312'
adb devices -l
npm run performance -- diagnose --device $perfDevice
npm run test:performance
node --test scripts/maestro-infra.test.cjs
```

Solo después de disponer de build y autorización, preparar offline y condiciones
reales. El archivo de ejemplo no acredita condiciones observadas: editar su copia.

```powershell
New-Item -ItemType Directory -Force test-results/performance
Copy-Item scripts/performance/conditions.example.json test-results/performance/conditions.json
notepad test-results/performance/conditions.json
$perfConditions = 'test-results/performance/conditions.json'
npm run performance -- capture --device $perfDevice --authorize $perfDevice --scenario PERF-01 --conditions $perfConditions --repeat 3 --duration 60 --interval 5 --settle 15 --launch yes
npm run performance -- capture --device $perfDevice --authorize $perfDevice --scenario PERF-02 --conditions $perfConditions --repeat 3 --duration 60 --interval 5 --settle 15
npm run performance -- capture --device $perfDevice --authorize $perfDevice --scenario PERF-03 --conditions $perfConditions --repeat 3 --duration 60 --interval 5 --settle 15
npm run performance -- capture --device $perfDevice --authorize $perfDevice --scenario PERF-04 --conditions $perfConditions --repeat 3 --duration 60 --interval 5 --settle 15
npm run performance -- capture --device $perfDevice --authorize $perfDevice --scenario PERF-05 --conditions $perfConditions --repeat 3 --duration 120 --interval 5 --settle 30
```

Para apertura completamente manual omitir `--launch yes`. Repetir el comando elegido
para obtener candidato; copiar rutas reales impresas por cada ejecución:

```powershell
$perfBaseline = Read-Host 'Ruta real al scenarios.json de referencia'
$perfCandidate = Read-Host 'Ruta real al scenarios.json candidato'
npm run performance -- compare --baseline $perfBaseline --candidate $perfCandidate
```

Captura opcional, solo tras revisar personalmente que la pantalla no tiene datos
sensibles. No se abre ni navega la app al tomarla:

```powershell
npm run performance -- screenshot --device $perfDevice --authorize $perfDevice --no-sensitive-data yes
```

## Métricas, fórmulas y objetivos académicos iniciales

Estos son **objetivos propuestos**, no resultados obtenidos:

| Objetivo                             | Medición e interpretación                                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 0 cierres inesperados                | Observación humana + fallos de proceso durante muestras; cobertura continua no disponible                   |
| Menos de 10 % de frames lentos       | 100 × frames válidos >16.667 ms / frames válidos; referencia fija de 60 Hz, comparar mismas condiciones     |
| 0 frames congelados                  | Conteo de frames válidos >700 ms; solo si cobertura completa verificable                                    |
| Sin crecimiento sostenido de memoria | Revisar >=3 PSS finales estabilizados, ciclos equivalentes y posibles causas; no hay umbral universal de MB |

PSS en kB viene de TOTAL de `dumpsys meminfo`: distribución proporcional de memoria
compartida, no heap JS ni RAM total. MiB = kB / 1024. Delta = final − inicial.
La tendencia entre puntos finales incluye `strictlyIncreasing`; es una señal de
revisión, nunca diagnóstico de fuga. Cachés, imágenes y GC pueden explicar aumentos.

`gfxinfo` (protocolo 3): delta Total frames rendered y Janky frames de una sola ventana,
con mismo PID, identidad opaca, época y bloque lógico en todas las muestras. Los
contadores del preámbulo global no se usan como fallback. Regla, limitaciones y
comandos gráficos controlados en [GFXINFO_COUNTERS.md](./GFXINFO_COUNTERS.md).
Jank % = 100 × delta janky / delta total. **No equivale al porcentaje de frames
lentos**. `framestats` se lee por cabeceras, usa Flags=0 y diferencia de timestamps
FrameCompleted − IntendedVsync en ns / 1e6. Deduplica pares de timestamps y excluye
los presentes antes del recorrido. Buffers parciales, flags, filas inválidas,
procesos nuevos o contadores ambiguos impiden aprobar cobertura. No se calcula FPS.
Contadores de múltiples procesos se consideran ambiguos. No se resetea gfxinfo.
Estos datos reflejan el pipeline HWUI observado; no certifican cobertura de todo el
trabajo JS, composición o renderizado GPU de React Native.

TotalTime de `am start -W` está en ms; el tiempo de invocación ADB se guarda aparte.
No confundirlo con respuesta visual completa. CPU: **No medible en esta entrega**;
no se ejecutó un sondeo por proceso autorizado. No se interpreta CPU del sistema
como CPU de CEMYDI ni se requiere root.

Los resúmenes calculan media/mínimo/máximo solo de métricas reales completas.
Comparación: mismas condiciones, instalación, dispositivo, escenario, duraciones y

> =3 repeticiones completas con PSS válido. Media PSS final candidata − media base;
> delta % = 100 × delta / media base, salvo base cero. Versiones distintas se rechazan:
> esta primera herramienta compara repetibilidad del mismo APK, no regresiones entre
> releases. Los dos resúmenes incluyen tiempos/gráficos disponibles para contrastarlos.

Salida `failed`: fallo observado o umbral gráfico incumplido. `pending`: evidencia
o revisión faltante. `not-comparable`: condiciones/datos incompatibles. `compared`
solo significa comparación calculada. Código 0 no equivale a criterio aprobado:
la herramienta nunca aprueba globalmente sin revisión humana de memoria/cierres.
Cambios de formato ADB bloquean o producen No medible con motivo.

## Android Studio

Abrir Android Studio ya instalado y seleccionar el dispositivo en Device Manager.
Tras autorización, usar Profiler sobre el proceso `com.cemydi.app` si la build permite
profiling. Una release sin profileable/debuggable puede limitar CPU/heap: registrar
No medible y continuar con PSS/gfxinfo ADB. No activar depuración, modificar manifiesto
ni reconstruir por esta limitación. No usar Development Build como referencia final.
Las trazas instrumentadas con sobrecosto se conservan separadas del recorrido ADB.
No exportar heap dumps, capturas ni trazas que contengan cuentas o tokens.

Referencias oficiales: [dumpsys](https://developer.android.com/tools/dumpsys),
[renderizado lento/congelado](https://developer.android.com/topic/performance/vitals/render),
[modo de desarrollo Expo](https://docs.expo.dev/workflow/development-mode/).

## Evidencias, resultados y pendientes

Cada invocación crea carpeta UTC + tipo + identificador aleatorio bajo
`test-results/performance/`, ya ignorado por Git/ESLint/Prettier. Escritura exclusiva:
no sobrescribe ejecuciones anteriores ni reportes históricos de Maestro.

- Diagnóstico: `metadata.json`, `timings.json`.
- Captura: `metadata.json`, `repetition-N.json`, `scenarios.json` (memoria, gráficos,
  tiempos, observación, estado, resumen), `memory.csv`, `metrics.csv`, `summary.md`, `timings.json`.
- Comparación: carpeta separada con `comparison.json` y hashes SHA-256 de los JSON
  de entrada para vincular la comparación con sus evidencias.
- Fallos: `error.json`; captura parcial queda incomplete, con datos válidos previos.
  Ctrl+C/SIGTERM intentan guardar el estado incompleto; una terminación forzada del
  proceso/host puede dejar solo metadata y repeticiones anteriores, nunca evidencia aprobada.
- Imagen manual: carpeta separada con `screen.png` y tiempos.

No se guardan dumps completos, logcat, jerarquías UI, respuestas HTTP ni stderr ADB.
Solo campos técnicos permitidos y filas numéricas parseadas. El serial es identificador
técnico necesario; revisar/redactar serial y capturas antes de compartir públicamente.

Configurado: CLI, parsers, cálculos, escenarios, guardas, evidencias y pruebas Node.
Ejecutado: diagnóstico de solo lectura y validaciones locales de infraestructura.
Pruebas verificadas: 17 pruebas Node de rendimiento, 6 de infraestructura Maestro;
Jest: 70 suites y 375 pruebas aprobadas. Jest emite avisos de React `act` en pruebas
existentes de pantallas; no afectan el resultado aprobado y no se modificaron esas suites.
TypeScript, ESLint y Prettier también pasaron; no cambiaron dependencias ni workflows.
El estado anterior corresponde a la preparación inicial. Posteriormente se ejecutó
PERF-01 con una build no depurable: hay PSS real, pero no tiempos de inicio ni métricas
gráficas válidas del intervalo. Véase el diagnóstico puntual siguiente. Permanecen
pendientes los indicadores no medidos, PERF-02 a PERF-05 con datos sintéticos aislados
y las comparaciones verificables. El criterio de rendimiento **no está aprobado**.

Para la rúbrica conservar carpetas completas baseline/candidato/comparación, APK
identificado por hash y procedencia (sin claves), commit/condiciones, pasos cubiertos,
limitaciones, observación de cierres y capturas explícitamente autorizadas.

Validación reproducible (sin dispositivo ni acceso HTTP):

```powershell
npm run typecheck
npm run lint
npm run format:check
npm run test:performance
node --test scripts/maestro-infra.test.cjs
npm test -- --ci
```

## Corrección puntual de PERF-01 — 26 de octubre de 2026

Se revisaron los archivos existentes sin ejecutar comandos Android ni nuevas capturas.
Ejecución analizada: `2026-10-26T05-56-32-345Z-capture-e3195cb3`.
SHA-256 del `scenarios.json` histórico:
`9596557df848af8e5db0335bc5c67f862a32082679fde8ac4623cd8db189b2bd`.
No se recalculan ni sobrescriben reportes históricos con los nuevos parsers.

### Evidencia comprobada

| Repetición | PSS inicial kB | PSS final estabilizado kB | Delta kB |
| ---------- | -------------- | ------------------------- | -------- |
| 1          | 174497         | 160992                    | -13505   |
| 2          | 160996         | 160988                    | -8       |
| 3          | 161204         | 160872                    | -332     |

Las 3/3 repeticiones están capturadas y marcadas completed. Media PSS final:
160950.67 kB. Esto describe memoria en esos puntos, no aprueba inicio ni renderizado
ni demuestra ausencia de fugas en otros recorridos.

Metadata: Android 10/API 29, STK-LX3; app 1.0.0/versionCode 1, sin DEBUGGABLE ni
Dev Launcher; instalación actualizada a `2026-10-25 23:47:11`. Es compatible con
release; la identificación como Preview procede del operador, no del parser.
Condiciones declaradas: background, empty-offline, guest; `--launch yes`.

`timings.json` confirma tres comandos `am start -W -n com.cemydi.app/.MainActivity`
con exit exitoso. El runner no fuerza cierre ni recrea actividad. PSS inicial válido
demuestra proceso previo en las tres repeticiones: **no se preparó ni verificó un
estado inicial frío con proceso inexistente**. Background es una declaración del operador; no se guardó
estado de actividad para probar reanudación frente a recreación.

La salida original de `am start -W` no fue conservada. El motivo genérico del parser
puede significar warning de tarea existente, TotalTime ausente/inválido u otro estado.
Por ello **retorno caliente es una hipótesis consistente, no causa íntegramente
comprobada**. No se puede reconstruir el warning exacto ni un tiempo de inicio a partir
de la duración del comando ADB. WaitTime mide la espera del comando, no sustituye
TotalTime ni certifica tiempo de pantalla interactiva.

Hay 33 muestras gráficas, 11 por repetición. Todas tienen PID 19757, los mismos diez
pares de timestamps y cero filas inválidas. El dispositivo **sí expuso framestats**;
no se sostiene que Android 10 o la build release impidan toda medición gráfica.
No aparecen nuevos frames capturados durante las muestras. Esto es compatible con
reposo, retorno sin redibujado o reporte HWUI que no refleja el trabajo visible;
no permite distinguir esas causas ni afirmar cobertura completa de la apertura.

En las 33 muestras el parser descartó los contadores con el motivo genérico
ausentes/múltiples/inválidos. No se guardaron las líneas originales ni el snapshot
gráfico inicial. **No se sabe si faltaban contadores, había varias secciones o existía
un formato OEM incompatible**. No se atribuye una causa específica al fabricante.
El mensaje histórico «Proceso cambió» era equívoco: el código agrupaba PID distinto
y contador inválido; los PID guardados son constantes. No se ha demostrado un cambio
de proceso. Sin contador inicial tampoco pueden excluirse frames previos del buffer.

### Correcciones acotadas

- `launchDiagnostics`: conserva únicamente flags de warnings conocidos, estado ok,
  ThisTime/TotalTime/WaitTime numéricos y LaunchState si existe; no guarda Intent,
  URI, errores completos ni texto privado. Warnings de reutilización siguen No medible.
- Parsers de tiempos/contadores limitados a una línea, compatibles con CRLF;
  campos vacíos no toman números de líneas siguientes. TotalTime duplicado se rechaza.
- `graphics.diagnostics`: número de etiquetas, coincidencias, valores numéricos/null,
  secciones de proceso y cabeceras. Se mantienen rechazados los contadores ambiguos:
  no se elige el primero ni se suman posibles duplicados sin salida real que lo justifique.
- `frameSummary`: distingue PID ausente/distinto, contadores inválidos y cero frames
  nuevos. Cero frames nuevos produce No medible, nunca 0 % de jank.
- El runner guarda `graphicsBefore`, contexto inicial y diagnóstico de lanzamiento
  en futuras capturas autorizadas. Protocolo 2: no comparar con protocolo 1; las
  ejecuciones históricas conservan su protocolo y archivos originales.

### Métodos separados para repetir la prueba

Android distingue frío (proceso nuevo), tibio/warm (recreación parcial de actividad)
y caliente/hot (retorno de actividad conservada). Ver
[estados de inicio de Android](https://developer.android.com/topic/performance/issues/launch-time).
No basta observar un PID presente para distinguir warm de hot.

**Los comandos siguientes no se ejecutaron.** Requieren autorización de la nueva
captura, app invitada sin datos personales, modo avión y toda red desconectada durante
la sesión. Crear condiciones nuevas; no reutilizar ni sobrescribir las históricas:

```powershell
$perfDevice = 'SLVNW20819004312'
$perfConfigDir = Join-Path 'test-results/performance' ('perf01-config-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $perfConfigDir
$perfConditions = Join-Path $perfConfigDir 'conditions.json'
Copy-Item scripts/performance/conditions.example.json $perfConditions
notepad $perfConditions
```

**Memoria y retorno caliente:** declarar `initialState=background` y las demás
condiciones realmente observadas. Antes de cada `ready`, enviar la app a segundo
plano manualmente con el botón Inicio del teléfono, conservando la actividad.
No tocar la app durante el lanzamiento automático ni el período estable.

```powershell
npm run performance -- capture --device $perfDevice --authorize $perfDevice --scenario PERF-01 --conditions $perfConditions --repeat 3 --duration 60 --interval 1 --settle 15 --launch yes
```

Si `launchDiagnostics.taskBroughtToFront/intentDelivered=true`, se confirma reutilización;
no reportar TotalTime como inicio nuevo. Si solo hay WaitTime, inicio queda No medible.
Para medir latencia visual hot puede usarse una traza de sistema Android 10 mediante
System Tracing/Android Studio, bajo autorización separada y sin instalar herramientas;
debe mostrar transición y primer frame. El runner actual no extrae esa latencia.

**Inicio frío:** preparar otro archivo de condiciones con `initialState=not-running`.
Si el proceso ya terminó naturalmente, comprobarlo antes de cada repetición. Para
prepararlo de forma determinista se necesita **autorización adicional para detener
la app**; autorizar capture no autoriza este comando. Solo con esa autorización,
en otra consola, antes de cada `ready`:

```powershell
adb -s $perfDevice shell am force-stop com.cemydi.app
if ($LASTEXITCODE -ne 0) { throw 'No se pudo detener la app autorizada.' }
adb -s $perfDevice shell pidof com.cemydi.app
$perfPidExit = $LASTEXITCODE
if ($perfPidExit -ne 1) { throw 'No se confirmó ausencia de proceso; revisar salida/estado ADB.' }
```

`pidof` vacío con exit 1 indica ausencia del proceso; desconexiones/otros fallos se
deben investigar, no ignorar. Ejecutar el mismo comando capture de arriba y preparar
el estado frío de nuevo antes de cada `ready`. No usar `am start -S`, limpieza de
datos ni reinicio como atajo. Sin permiso de detención, el inicio frío controlado
queda pendiente. Un nuevo proceso no implica cachés de disco vacías.

**Warm/tibio:** terminar y recrear solo actividad manteniendo proceso requiere un
procedimiento adicional autorizado y prueba de lifecycle. No se implementa ni se
simula con Home; no mezclar estos resultados con hot/cold.

**Renderizado:** realizar una ejecución separada en foreground, sin `--launch yes`,
partiendo de Inicio con contenido local y un recorrido de scroll fijo acordado:

```powershell
npm run performance -- capture --device $perfDevice --authorize $perfDevice --scenario PERF-01 --conditions $perfConditions --repeat 3 --duration 30 --interval 1 --settle 15
```

Antes editar esa nueva configuración a `initialState=foreground`; usar otra copia
para conservar las condiciones de inicio. Si no hay contenido desplazable, marcar
skipped. Esta ejecución caracteriza renderizado al interactuar, no tiempo de inicio.
El intervalo solicitado de 1 s no elimina el sobrecosto ADB ni asegura capturar todos
los frames. Para cold, el snapshot previo puede carecer de PID/contadores: gráficos
del arranque completo siguen No medible; no poner un baseline artificial de cero.

Leer `repetition-N.json`: contrastar `graphicsBefore` con muestras y diagnostics.
Dos o más coincidencias de contadores requieren inspección del formato original
antes de cambiar selección de secciones; etiquetas sin coincidencia indican formato
no reconocido. Si no hay contadores pero sí frames, documentar esa disponibilidad
parcial, sin calcular jank. Mismos frames con contador sin avance significan que no
hay nuevos frames atribuibles al intervalo observado. No usar frames antiguos para
calcular porcentajes del arranque. No se calculan FPS ni se aprueban indicadores ausentes.

Validación de esta corrección: TypeScript, ESLint y Prettier aprobados; 22 pruebas
Node de rendimiento + 6 de infraestructura Maestro; Jest 70 suites/375 pruebas
aprobadas, con avisos `act` en suites existentes. Hash agregado del árbol histórico
`test-results/performance` idéntico antes/después:
`0a608eaffdd9aab61156419e44e075ac457517545fc0f702a6998ff65e114086`.
No se ejecutaron capturas ni comandos Android en esta revisión.

## Actividad 6

La referencia del 16 de noviembre de 2026 es
`test-results/performance/2026-11-16T06-56-24-936Z-capture-285a5099/`. Las tres
repeticiones registraron entrega del intent a una actividad existente. Hubo PSS y
jank de ventana medibles. Las 100 filas nuevas de framestats por repetición fueron
insuficientes frente a 342, 339 y 370 frames según HWUI. El objetivo quedó
`pending`. Conservar la carpeta completa como evidencia de retorno caliente.

### PERF-01 con inicio frío controlado

Usar el APK instalado, en modo avión, con Wi-Fi y las demás conexiones de red
desactivadas y sesión invitada. Preparar un JSON independiente, como
`test-results/performance/conditions-perf01-cold.json`, con
`initialState: "not-running"`. Ajustar a las condiciones observadas. Un proceso
nuevo puede reutilizar datos y cachés de disco.

```powershell
adb devices -l
$perfDevice = Read-Host 'Serial ADB por USB (estado device)'
adb -s $perfDevice get-state
$perfCold = '.\test-results\performance\conditions-perf01-cold.json'
npm run performance -- capture --device $perfDevice --authorize $perfDevice --scenario PERF-01 --conditions $perfCold --repeat 3 --duration 60 --interval 5 --settle 15 --launch yes
```

En una segunda consola PowerShell, declarar el mismo `$perfDevice`. Antes de
**cada** `ready`, detener manualmente la app y verificar que la lista de
procesos es válida y carece del paquete y de sus procesos con sufijo.

```powershell
adb -s $perfDevice shell am force-stop com.cemydi.app
if ($LASTEXITCODE -ne 0) { throw 'Falló force-stop.' }
$perfProcesses = @(adb -s $perfDevice shell ps -A -o PID,NAME)
if ($LASTEXITCODE -ne 0 -or $perfProcesses[0] -notmatch '^\s*PID\s+NAME\s*$') {
  throw 'No se pudo verificar la lista de procesos.'
}
if ($perfProcesses -match '\scom\.cemydi\.app(:\S+)?\s*$') {
  throw 'La app todavía tiene un proceso activo.'
}
```

Tras verificar la ausencia, escribir `ready` sin abrir la app. Dejarla estable
hasta el registro de la observación. Si falla la preparación o el aislamiento,
corregir la condición antes de reintentar. La ruta impresa en `Evidencias:`
identifica la ejecución, incluso si termina con `error.json`.

Esperar PSS inicial y delta como `No medible` por ausencia de proceso inicial,
con PSS posterior y final estabilizado si la captura se completa. Revisar
`launchDiagnostics` de cada repetición. Reportar como inicio frío un
`TotalTime` positivo aceptado por el parser con ausencia de proceso verificada,
sin reutilización ni estado `WARM` o `HOT` informado por Android. Si Android
omite `LaunchState`, consignar esa ausencia y la verificación manual previa.
`WaitTime` queda como diagnóstico. Sin un baseline válido de la misma ventana y
proceso, las métricas gráficas del intervalo quedan `No medible`.

### PERF-06 — Renderizado de pantalla local

#### Modo opcional de CPU y traza nativa

El protocolo vigente es **12** al usar `--native-trace yes` en PERF-06.
Las descripciones de protocolos anteriores que siguen son históricas.
No comparar directamente capturas de protocolos distintos.

Corrección del protocolo 12:

- La segunda columna de SurfaceFlinger (`actualPresentTime`) determina si
  la presentación está pendiente. Un `frameReadyTime` pendiente no invalida
  una presentación real ya conocida. Cada fila conserva identidad, tiempos
  numéricos y campos pendientes explícitos; `INT64_MAX` nunca se trata como tiempo.
- Después de la estabilización se conserva `presentationResolutionSamples`.
  Esta consulta solo resuelve identidades que ya estaban en las muestras del
  recorrido. No incorpora frames nuevos de los 15 s finales. Los frames del
  baseline permanecen excluidos aunque su fence se resuelva después. Un fence
  del recorrido sin resolver, sobrescrito o con identidad contradictoria sigue
  bloqueando FPS. Las muestras antiguas con solo un booleano `pending` no permiten
  reconstruir estas identidades y no se reinterpretan como mediciones completas.
- El recolector HWUI arranca antes del baseline, con pausa solicitada de 10 ms.
  Se excluye únicamente su prefijo anterior al baseline; se conservan reinicios
  e inconsistencias posteriores. Se registran límites propios del muestreo HWUI,
  distintos de los límites CPU. La frecuencia real depende de `dumpsys` y del
  dispositivo; reducir la pausa aumenta el coste de observación.
- `excludedFrames` conserva Flags, IntendedVsync y FrameCompleted de las filas
  válidas con Flags no cero, sin nombres ni texto privado. `graphics.value.coverage`
  distingue filas elegibles, excluidas, inválidas y frames no contabilizados.
  Un faltante no demuestra por sí solo sobrescritura del buffer. No se altera el
  denominador ni los umbrales de jank, frames lentos/congelados o memoria. Las filas
  excluidas no habilitan cobertura completa ni se cuentan como rápidas.

La captura histórica de protocolo 11
`2026-11-22T19-29-25-914Z-capture-9889b47c` conserva CPU medible en tres
repeticiones, pero faltan 6/4/6 frames elegibles y dos resultados FPS están
bloqueados por el diagnóstico anterior de fences. No contiene las identidades
pendientes ni las filas Flags excluidas necesarias para corregir esos resultados
retrospectivamente. Sus archivos se conservan sin modificaciones.

- CPU: ProcessTree usa un buffer independiente de 4 MiB, sondeo de procesos
  cada segundo y renovación del estado incremental cada 5 segundos. Evita
  depender de un único inventario inicial mezclado con eventos sched. Se mantiene
  el buffer sched de 32 MiB, streaming a archivo y los controles de pérdida.
- HWUI: un proceso ADB independiente consulta `framestats` en un bucle acotado
  por `/proc/uptime`, con pausa solicitada de 10 ms. No se interrumpe durante
  `meminfo`, conectividad o consultas de presentación del proceso principal.
  La frecuencia real incluye el coste de `dumpsys` y no está garantizada.
  Solo se guardan muestras parseadas y redactadas dentro de los límites del
  recorrido en `continuousGraphicsSamples`; no se persiste la salida textual.
  Un snapshot final síncrono cierra la ventana. Las fórmulas de jank, lentos,
  congelados y memoria permanecen iguales; cobertura incompleta sigue siendo
  `No medible`. PSS conserva su intervalo solicitado de 1 s y 15 s de estabilización.
- FPS: se consulta `SurfaceFlinger --list` y `--latency` solo para una capa
  exacta de MainActivity de CEMYDI. Sin capa única, permiso, solapamiento de
  buffers o timestamps válidos, permanece `No medible`. No se habilitan ni
  limpian estadísticas globales del compositor. Los fences pendientes finales
  también bloquean el resultado. No se usan callbacks Choreographer como FPS.
  `presentation.json` conserva el resultado individual. FPS = (N − 1) / tiempo
  entre primera y última presentación nueva, excluyendo el baseline y deduplicando
  solapamientos. Es el promedio de esa ventana observada, **no el promedio de los
  30 s**; excluye reposo inicial/final e incluye pausas intermedias. No representa
  por sí solo FPS exclusivo durante el gesto ni sirve para umbrales HWUI.
- Se elimina el sondeo repetido de `dumpsys cpuinfo`, que entregaba ventanas
  antiguas y añadía coste. CPU se calcula con los intervalos sched de la traza.

Compatibilidad: [FrameTimeline requiere Android 12 o posterior](https://perfetto.dev/docs/data-sources/frametimeline).
Android 10 imprime desiredPresentTime, actualPresentTime y frameReadyTime en
[FrameTracker::dumpStats](https://android.googlesource.com/platform/frameworks/native/+/android10-release/services/surfaceflinger/FrameTracker.cpp).
Los campos de sondeo y caché usados existen en
[ProcessStatsConfig de Android 10](https://android.googlesource.com/platform/external/perfetto/+/android10-release/protos/perfetto/config/process_stats/process_stats_config.proto).

La disponibilidad de la capa y la cobertura del buffer HWUI se deberán comprobar
en la próxima captura manual. Los tests sintéticos no certifican el firmware.
El sondeo adicional tiene coste y puede afectar el rendimiento observado.
No se modifican la app ni las capturas históricas. Se conservan tres repeticiones,
preparación manual, aislamiento offline y respuestas humanas `ready`/resultado.

```powershell
npm run performance -- capture --device $perfDevice --authorize $perfDevice --scenario PERF-06 --conditions $perfConditions --repeat 3 --duration 30 --interval 1 --settle 15 --native-trace yes
```

El protocolo 10 añade `task/task_newtask`, `sched/sched_process_exit`
y nombres de hilos en ProcessTree. Usa CLONE_THREAD y el TID creador para
distinguir nuevos hilos del proceso de procesos hijo independientes. Los
intervalos anteriores al nacimiento conocido de un TID quedan sin atribuir.
`sched_process_exit` inicia la salida: el hilo todavía puede bloquearse, reanudarse
y consumir CPU durante la limpieza. No se usa como límite final de ejecución.
Reutilización ambigua de TID o parentesco ausente mantiene CPU total `No medible`.
Estos eventos están presentes en la captura del 22 de noviembre de protocolo 10.

El analizador de pérdidas compara snapshots del servicio y pares START/END de
FtraceStats por cada CPU observada, incluyendo overrun, commit_overrun y
dropped_events. Los contadores globales de descarte del servicio acumulan su
historial y un valor inicial estable se conserva como diagnóstico. Los contadores
de buffer pertenecen a esta sesión: un valor inicial no nulo bloquea el cálculo.
Aumentos de pérdida, reinicios o ausencia de estadísticas también lo bloquean.
La distinción corresponde a EmitTraceStats en la
[implementación de Perfetto para Android 10](https://android.googlesource.com/platform/external/perfetto/+/refs/heads/android10-dev/src/tracing/core/tracing_service_impl.cc).
El informe expresa el estado real de CPU, en vez de afirmar que la atribución
y pérdida ya fueron verificadas.

Los archivos existentes pueden revisarse otra vez con `analyze-cpu`, que crea
un informe nuevo. Las trazas antiguas no contienen los eventos de ciclo de vida
recién configurados y no pueden recuperar información omitida retrospectivamente.
Las nuevas capturas necesitan validación física de atribución y pérdida.

El análisis corregido de `2026-11-22T19-08-21-417Z-capture-b79f2d05` obtiene
CPU medible en las repeticiones 2 y 3: 50.721466% y 53.846774% de una CPU lógica,
con ventanas de 30.79 y 30.76 segundos. Ambas tienen cero TID sin clasificar,
cero discontinuidades y controles de pérdida aprobados. La repetición 1 carece
de identidad del proceso en ProcessTree y permanece `No medible`; no se sustituye
con metadatos de otras repeticiones. El nuevo informe se guarda en un directorio
`cpu-analysis` separado y no cambia los resultados originales.

FPS sigue necesitando eventos de presentación atribuibles a la superficie
de CEMYDI. Los callbacks de Choreographer o el número de eventos ftrace no prueban
ese número. Slow/Frozen Frames siguen exigiendo cobertura HWUI completa o
equivalencia demostrada de otra fuente con IntendedVsync–FrameCompleted.
Las trazas actuales no establecen esa equivalencia. Se conservan las métricas
como No medible y las fórmulas estrictas. Una nueva captura tampoco garantiza
que esas fuentes estén disponibles en Android 10.

El protocolo 9 incorpora un análisis offline de CPU con `sched_switch`.
En nuevas capturas, `cpu.json` usa `cpuFromTrace.process` como resultado
principal y conserva las ventanas cpuinfo como diagnóstico.
Para analizar una captura ya guardada sin ADB ni cambiar sus archivos:

```powershell
npm run performance -- analyze-cpu --capture '.\test-results\performance\2026-11-22T00-05-48-779Z-capture-9aca0e3b'
```

El comando crea otro directorio `cpu-analysis` con `cpu.json` y hashes de
las trazas de entrada. Verifica el SHA-256, la identidad del proceso en ProcessTree,
el mapa TID/TGID y los intervalos en que cada CPU ejecutaba un hilo.
Recorta cada intervalo a los límites del recorrido y suma los tiempos de todos
los hilos identificados del proceso. Porcentaje = 100 × segundos CPU / segundos
del recorrido, con 100% equivalente a una CPU lógica. Puede superar 100%.
Se comprueban extremos sched_switch por CPU, discontinuidades prev/next, pérdida
del servicio y TID sin pertenencia. Datos incompletos dejan CPU total `No medible`.
La reconstrucción de intervalos presentes se publica por separado como
`observedIdentifiedThreads`, estado `review-required`, para revisión técnica.
Su porcentaje parcial no debe presentarse como CPU total verificada.

En la captura del protocolo 8, las tres trazas tienen TID programados sin
pertenencia y contadores de descarte del servicio distintos de cero. La tercera
también declara sobrescritura de buffer. Por ello, cubrir los extremos temporales
no basta para aprobar CPU total. Este diagnóstico no requiere otra captura ni
reescribe los resultados originales.
Esquemas de referencia en [ProcessTree](https://raw.githubusercontent.com/google/perfetto/master/protos/perfetto/trace/ps/process_tree.proto),
[sched_switch](https://raw.githubusercontent.com/google/perfetto/master/protos/perfetto/trace/ftrace/sched.proto)
y [TraceStats](https://raw.githubusercontent.com/google/perfetto/master/protos/perfetto/common/trace_stats.proto).

La captura `2026-11-21T23-58-11-344Z-capture-7dcf409d` completó las
repeticiones con trazas válidas de unos 32 MiB, pero sus primeros eventos
dejaban fuera el inicio del recorrido. El protocolo 8 activa
`write_into_file: true` y `file_write_period_ms: 1000` para vaciar
periódicamente el buffer de 32 MiB al archivo remoto y conservar los eventos
iniciales. El tamaño máximo del archivo es 128 MiB. Alcanzar ese límite puede
terminar la traza antes de tiempo y debe investigarse.
La descarga binaria admite 160 MiB y un timeout de 60 s.
Estos campos existen en la configuración de Android 10 y el comportamiento
se describe en [Perfetto, escritura periódica](https://perfetto.dev/docs/concepts/config).

Se esperan 2 s antes de registrar el inicio del recorrido, para dar margen de
arranque a las fuentes. Ese margen no certifica disponibilidad. Al terminar,
`traceCoverage` comprueba que todas las CPU observadas tengan eventos antes
del inicio y después del final, comparando el reloj boot de ftrace con uptime.
Si falta algún extremo, hay bundles con pérdida, reloj diferente o codificación
compacta no soportada, devuelve `No medible`. Cubrir los extremos queda
`review-required`, porque no demuestra ausencia de huecos internos o pérdidas
del servicio. La revisión completa sigue exigiendo estadísticas, identidad y
atribución de eventos. El diagnóstico también sirve para detectar nuevas pérdidas
sin confundir un archivo binario válido con cobertura suficiente.

La CPU global del recorrido continúa pendiente del análisis de eventos sched y
del mapeo de hilos al proceso en la nueva traza completa. Las consultas cpuinfo
siguen rechazando ventanas antiguas. No se sustituyen por porcentajes históricos.
La escritura periódica incrementa el trabajo de almacenamiento y debe mantenerse
igual entre ejecuciones comparadas. Se conserva el mismo comando de PERF-06.

El diagnóstico `2026-11-21T23-54-28-208Z-trace-check-03c0ba77` permitió
comprobar una alteración binaria CRLF en la salida del shell. Invirtiendo solo
en memoria la inserción de CR antes de LF se recuperó un contenedor válido de
5,345,663 bytes, 1,453 paquetes y 101,123 eventos ftrace. El original se conserva.
No se aplica normalización a futuras capturas, porque podría alterar bytes legítimos.
El protocolo 7 escribe la traza nativa a un nombre UUID exclusivo bajo
`/data/misc/perfetto-traces/`, y la descarga después mediante `adb exec-out cat`.
Así la configuración viaja por shell stdin y el binario por un canal independiente.
Los mensajes del proceso de grabación no se mezclan con la traza.
La ruta remota se registra en el JSON y el archivo queda en el teléfono.
Cada repetición usa un nombre nuevo. No se sobrescriben ni eliminan trazas previas.
La descarga tiene timeout propio de 15 s, límite de 64 MiB y validación protobuf.

La captura `2026-11-21T23-51-14-716Z-capture-09b599b5` terminó el comando
nativo en 41.88 s y recibió 34,088,440 bytes, sin error de proceso ni timeout.
El validador los rechazó y la versión anterior descartó la salida. Su causa
precisa permanece pendiente de inspección binaria. Se añadió conservación local
exclusiva como `repetition-N.unvalidated.bin` con hash y estado `unvalidated`.
La salida rechazada continúa siendo un fallo y nunca se usa para aprobar métricas.
Los diagnósticos ahora identifican etapa, paquetes, bundles y eventos analizados,
además de offsets numéricos del fallo de estructura.

Antes de repetir las tres repeticiones, el operador puede comprobar solo la
fuente nativa durante 10 s, sin desplazamientos ni respuestas automáticas:

```powershell
npm run performance -- trace-check --device $perfDevice --authorize $perfDevice
```

Mantener el dispositivo de pruebas offline. Se crea una carpeta `trace-check`
independiente y se conservan resultado, diagnóstico y salida binaria disponible.
Compartir esa carpeta completa para inspección local. Si termina en fallo,
corregir la causa verificada antes de repetir el recorrido de rendimiento.

Agregar `--native-trace yes` habilita el protocolo 10 únicamente en PERF-06.
La captura `2026-11-21T23-48-05-106Z-capture-faa06c47` del protocolo 5
alcanzó el timeout de 65 s, sin una traza conservada. El registro previo
no permite atribuir inequívocamente el bloqueo a stdin o al servicio.
Se cambia el transporte a `adb shell -T` para enviar configuración por stdin
con cierre del canal y salida binaria sin pseudo-terminal.
El procedimiento oficial de Perfetto para Android anterior a 12 utiliza
[configuración por stdin con adb shell](https://github.com/google/perfetto/blob/main/docs/concepts/config.md).
Se conservan duración, límites y validación binaria. Los fallos ahora distinguen
timeout, cancelación, error de proceso, formato inválido y salida prematura.
Se registran bytes recibidos y diagnóstico estructural sin copiar stderr.
Un fallo temprano se detecta en el siguiente ciclo de muestreo y aborta el recorrido.
La revisión anterior (protocolo 4) usaba una opción `-a` que el Perfetto del
teléfono rechazó, devolviendo ayuda con código 0. Esos tres archivos históricos
son texto de error y se conservan como evidencia del fallo.
La versión corregida envía la configuración pbtxt por stdin con `--txt -c -`,
opciones presentes en la ayuda del dispositivo. El paquete se selecciona mediante
`atrace_apps` dentro de la configuración, junto con sched, gfx/view,
ftrace/print y el inventario inicial de procesos.
Ahora se comprueba estructura protobuf de Trace/TracePacket/FtraceEvent,
al menos un evento con timestamp y payload, y duración del comando coherente
con la configuración. Ayuda, salida vacía, binario truncado, ausencia de eventos
o terminación inmediata quedan como fallo. La validación estructural sigue
requiriendo análisis posterior de cobertura y atribución.
Las respuestas a `ready` y al resultado siguen siendo manuales.
La CLI inicia una sesión Perfetto nativa limitada a duración del recorrido +10 s
antes de anunciar CAPTURANDO. Recoge sched/gfx/view y atrace de com.cemydi.app.
Al finalizar espera el proceso y conserva un archivo binario por repetición,
SHA-256, tamaño, horas y comando en `repetition-N-trace.json`. Una traza guardada
queda `captured` con análisis `pending`. El código de salida del comando no
demuestra que todas las fuentes estén disponibles ni que cubran el recorrido.
Si Perfetto falla, el fallo queda explícito y se conserva la captura parcial.
La sesión tiene timeout, buffer solicitado de 32 MiB con escritura periódica,
límite de archivo de 128 MiB y máximo de descarga de 160 MiB.
Una cancelación termina el cliente ADB; la sesión remota puede durar hasta su
límite configurado. No se borran archivos ni se resetean estadísticas.

La traza puede incluir nombres de procesos/hilos y metadatos del sistema.
Usar exclusivamente el entorno dedicado sin cuentas ni datos personales y
conservarla localmente. El modo requiere el binario Perfetto ya incluido en
Android, compatibilidad de sus opciones y permisos de sus fuentes.
La disponibilidad del dispositivo se verificará durante la ejecución manual.
No se instalaron herramientas de análisis locales.

Además se consulta `dumpsys cpuinfo` después de cada muestra gráfica. Solo se
exporta el porcentaje de la fila exacta del proceso principal cuyo PID coincide
con el observado en gfxinfo y su ventana temporal relativa. Se conserva en
`cpuSamples` y `cpu.json`. Proceso ausente, duplicado, cambiado o formato
desconocido producen `No medible`; un fallo de ADB interrumpe la captura.
El porcentaje describe la ventana del muestreador Android. Solo se acepta si
su inicio queda dentro del tiempo ya transcurrido desde el comienzo del recorrido,
medido antes de invocar cpuinfo. Las ventanas anteriores o parcialmente anteriores
quedan `No medible` con motivo explícito. La última captura del protocolo 4
contenía ventanas antiguas en las 53 consultas. No representan CPU del recorrido.
Incluso las ventanas válidas pueden solaparse entre muestras. No se promedian esas
ventanas ni se interpretan filas ausentes como CPU cero. No incluye subprocesos.
El trabajo adicional aumenta el intervalo real y el sobrecosto.

Para repetir con las condiciones independientes revisadas y la pantalla preparada:

```powershell
$perfDevice = Read-Host 'Serial ADB por USB'
$perfConditions = '.\test-results\performance\perf06-config-1a5d46a9e00843b7a59a4a0da6d2df67\conditions.json'
Get-Content -Raw -LiteralPath $perfConditions
npm run performance -- capture --device $perfDevice --authorize $perfDevice --scenario PERF-06 --conditions $perfConditions --repeat 3 --duration 30 --interval 1 --settle 15 --native-trace yes
```

Conservar toda la carpeta, especialmente los tres .perfetto-trace y sus JSON.
Los límites del recorrido se registran con /proc/uptime antes del anuncio y
después de la última muestra. Contrastarlos con el reloj de la traza.
Comprobar en Perfetto la identidad del proceso, cobertura de esos límites,
eventos sched y gráficos, pérdida de eventos, saturación y trazas truncadas.
CPU media del recorrido puede obtenerse después sumando tiempo programado de
todos sus hilos dentro de esos límites y dividiendo entre la duración.
FPS requiere eventos de presentación atribuibles a la superficie de CEMYDI.
Contar doFrame por segundo mide callbacks, cuya relación con frames presentados
requiere validación independiente.

En Android 10 hay trazas de UI/RenderThread y SurfaceFlinger. FrameTimeline
requiere Android 12. La disponibilidad de una traza por sí sola no certifica
las duraciones IntendedVsync–FrameCompleted. Slow/Frozen conservan su fuente
HWUI, fórmulas y regla estricta. Su análisis mediante otra fuente requiere
probar equivalencia y cobertura. FPS permanece No medible hasta esa revisión.
El modo nuevo no garantiza resolver las métricas gráficas pendientes.
Comparar exclusivamente ejecuciones del mismo protocolo e instrumentación.
Referencias en [Perfetto CLI](https://perfetto.dev/docs/reference/perfetto-cli),
[Android 10 y jank](https://developer.android.com/studio/profile/jank-detection)
y [FrameTimeline](https://perfetto.dev/docs/data-sources/frametimeline).

La investigación de cobertura de la captura del 21 de noviembre, costos ADB,
historial circular y comparación de alternativas está en
[GFXINFO_COUNTERS.md](./GFXINFO_COUNTERS.md#investigación-de-cobertura-perf-06-del-21-de-noviembre-de-2026).
Se conserva el procedimiento periódico siguiente. La nueva corrección elimina
la lectura redundante del objeto final y protege muestras ausentes, con cobertura
estricta. Repetir el recorrido permite evaluar PSS, jank y cobertura efectivamente
obtenida. Slow Frames y Frozen Frames siguen condicionados a cobertura completa.

Abrir manualmente como invitado Inicio → Ayuda y contacto (`/perfil/ayuda`).
La pantalla pública usa contenido local y un contenedor desplazable. Prepararla
arriba del contenido antes de cada repetición, con las preguntas frecuentes en
el mismo estado. Mantener modo avión, Wi-Fi apagado y toda red desconectada.
La CLI exige `foreground`, `guest`, `offline` y `empty-offline`, proceso
activo y build representativa. El operador verifica pantalla y sesión.

Crear condiciones independientes desde la raíz del repositorio. El ejemplo debe
ajustarse a batería, carga, temperatura, brillo y caché realmente observados.
La copia se guarda en una carpeta nueva para conservar las condiciones anteriores.

```powershell
$perfDevice = Read-Host 'Serial ADB por USB'
$perfConfigDir = Join-Path '.\test-results\performance' ('perf06-config-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $perfConfigDir | Out-Null
$perfConditions = Join-Path $perfConfigDir 'conditions.json'
$perfConfig = Get-Content -Raw '.\scripts\performance\conditions.example.json' | ConvertFrom-Json
$perfConfig.initialState = 'foreground'
[IO.File]::WriteAllText((Join-Path (Get-Location).Path $perfConditions), ($perfConfig | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
notepad $perfConditions
npm run performance -- capture --device $perfDevice --authorize $perfDevice --scenario PERF-06 --conditions $perfConditions --repeat 3 --duration 30 --interval 1 --settle 15
```

Los valores por defecto de PERF-06 son 3 repeticiones, 30 s, intervalo solicitado
de 1 s y estabilización de 15 s. Omitir `--launch`, que se rechaza para este escenario.
En cada repetición el operador confirma personalmente `ready`. Al aparecer
`CAPTURANDO`, hacer tres desplazamientos verticales controlados con el mismo
sentido, distancia y ritmo entre repeticiones, regresar arriba dentro de los
30 s y esperar estable los 15 s finales. Evitar pulsar contactos, mapas,
enlaces externos o desplegables durante el recorrido.

Registrar personalmente `completed` si se cubrió todo el recorrido y se observó
la interfaz, `skipped` si falta contenido desplazable o no se pudo preparar,
`crash` ante cierre inesperado y `error` ante otro fallo. Si la preparación
es imposible antes de `ready`, cancelar. Un fallo técnico puede interrumpir
la captura antes de la pregunta final y debe conservarse en las evidencias.

La ruta impresa en `Evidencias:` contiene metadata, `repetition-1.json` a
`repetition-3.json`, `scenarios.json`, CSV, resumen y tiempos técnicos.
Se mantiene escritura exclusiva en carpetas UTC con sufijo único.
PSS inicial/final, delta y estadísticas HWUI usan las fórmulas existentes.
Jank exige continuidad verificable de PID, ventana y época. Frames lentos y
congelados exigen además cobertura completa. Las métricas insuficientes quedan
`No medible`, con motivo. El intervalo de 1 s tiene sobrecosto ADB y no garantiza
cobertura. CPU y FPS siguen sin fuente suficiente. El objetivo global permanece
`pending` hasta completar la revisión requerida, o `failed` si corresponde.

PERF-06 complementa las pruebas de catálogo, detalle, carrito y API. Su captura
caracteriza desplazamientos en una pantalla ya abierta. La ejecución física queda
a cargo del operador, con respuestas manuales a ambos prompts.

### Procedencia del APK

La referencia registró `develop` en `5399ec6944bffb4e14023f9d229d8d520de2e4e2`,
con cambios locales. El diagnóstico identificó `com.cemydi.app` 1.0.0,
versionCode 1, como release-compatible en un HUAWEI STK-LX3 con Android 10/API 29.
El commit de diagnóstico describe el checkout. La asociación con el APK sigue
pendiente.

Si se usó el workflow Android Preview, localizar la ejecución histórica en
GitHub Actions. Su resumen registra el commit y el ID de EAS para el APK terminado.
Descargar ese artefacto, calcular su SHA-256 con `Get-FileHash` y cotejarlo con el
SHA-256 del APK instalado obtenido mediante la ruta de `adb shell pm path`.
Si hay splits, falta el artefacto o no se puede leer el APK instalado, conservar
el estado pendiente. La coincidencia de versionCode y versionName por sí sola
deja la procedencia pendiente.
