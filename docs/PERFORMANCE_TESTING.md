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
