# Actividad 4: pruebas de carga HTTP local

## Objetivo académico

Implementar y evaluar un perfil de carga moderada y tolerancia a fallos con datos
sintéticos. La evidencia permite observar concurrencia, ritmo, latencia, errores
esperados y recuperación de un servidor HTTP local. El sistema evaluado es el
fixture público de `scripts/maestro-api.cjs`, no el backend ni la aplicación móvil.

La implementación y sus pruebas automatizadas no constituyen resultados de la
prueba de carga completa. Esa ejecución se realiza manualmente con el comando de
este documento; no se ejecuta como parte de `test:load`.

## Herramientas y justificación técnica

Node.js estándar: `node:http`, reloj monotónico `performance.now()`,
`AbortController`, temporizadores, filesystem y `node:test`. No se agregan
dependencias. Entorno de validación inicial: Node.js 24.11.0 en Windows.

`node:http` permite consumir completamente la respuesta y rechazar redirecciones
sin seguirlas. El transporte directo hacia IPv4 numérica no usa proxies, cookies,
sesión móvil ni cliente HTTP de la app. Un servidor por ejecución escucha mediante
`listen(0, '127.0.0.1')`: el OS elige un puerto libre y el cliente conserva ese
puerto en una clausura, comprobando además dirección/puerto del socket conectado.
No existe opción de URL, host, puerto, headers ni credenciales en la CLI.

## Arquitectura

- `scripts/load/protocol.cjs`: protocolo versionado, fases, límites y lista exacta
  de rutas GET sintéticas permitidas.
- `local-session.cjs`: instancia aislada del fixture, transporte HTTP, deadlines,
  cancelación y limpieza de sockets/temporizadores. Envuelve el handler solo en la
  instancia del arnés para inyectar fallos; no modifica `maestro-api.cjs`.
- `runner.cjs`: lotes acotados, pausa entre lotes, criterios y paradas críticas.
- `metrics.cjs`: contadores y percentiles reproducibles.
- `reports.cjs`: cuatro evidencias por ejecución e identificación de fuentes por
  SHA-256, sin bodies ni datos privados.
- `cli.cjs`: entrada manual fija y manejo de Ctrl+C/SIGTERM.
- `load.test.cjs`: verificaciones unitarias con reloj simulado y pequeños casos
  HTTP reales contra instancias locales desechables.

Las funciones internas permiten sustituir reloj, fixture o límites menores para
pruebas automatizadas. Estas opciones no se exponen por CLI; no permiten elevar
los límites del protocolo. La simulación completa de planificación no abre
conexiones HTTP ni equivale a ejecutar la carga completa.

## Escenarios y límites

| Fase               | Nombre en evidencia | Solicitudes | Concurrencia máxima | Ritmo máximo |
| ------------------ | ------------------- | ----------: | ------------------: | -----------: |
| Calentamiento      | warmup              |          10 |                   1 |          1/s |
| Referencia         | baseline            |          30 |                   1 |          1/s |
| Carga moderada     | moderate            |          40 |                   2 |          2/s |
| Ráfagas pequeñas   | bursts              |          80 |                   4 |          4/s |
| Fallos controlados | faults              |          20 |                   2 |          2/s |

Máximos globales: 180 solicitudes, cuatro simultáneas, 180 segundos para el perfil
y timeout absoluto de 2000 ms por petición, incluyendo consumo del body. La
escritura de evidencias ocurre después del perfil y no genera tráfico HTTP.
No hay reintentos automáticos ni una cola que acumule trabajo.

Un lote contiene como máximo la concurrencia de su fase. El siguiente espera la
terminación de todo el lote anterior y al menos 1000 ms desde su última solicitud
iniciada. Esto también aplica al cambiar de fase. Si un timeout alarga un lote, no
se compensa con solicitudes adicionales ni se acelera el siguiente lote.

En `faults`, las solicitudes 1 y 2 reciben 503; las 3 y 4 quedan sin respuesta
hasta que vence su timeout. Las otras 16 respuestas normales tienen 200 ms de
retardo añadido. La solicitud 20 consulta `/promotions` para comprobar recuperación
después de todos los fallos, dentro de las 180 solicitudes globales.

Las rutas exactas están en `protocol.cjs`: catálogo paginado de dos equipos,
búsqueda sintética `Equipo`, detalle de productos 1/2, recomendaciones, reseñas
vacías y promociones vacías. No se solicitan imágenes ni enlaces contenidos en
respuestas. No se permiten rutas arbitrarias, métodos de escritura, headers de
autenticación ni cookies. No se leen `.env` ni credenciales.

## Mediciones y aceptación

Cada fase registra planificadas, iniciadas, completadas, éxitos, errores HTTP,
fallos de transporte, timeouts, cancelaciones, errores esperados e inesperados,
concurrencia máxima real, latencias mínima/mediana/p95/máxima, duración, solicitudes
por segundo observadas y cumplimiento individual de criterios.

`completed` cuenta resultados terminales, incluidos timeout y cancelación.
`responsesConsumed` cuenta respuestas HTTP con body totalmente consumido.
`successful` cuenta respuestas 200. La latencia empieza antes de crear la petición
y acaba al consumir todo el body; ante timeout/cancelación acaba al terminar esa
operación. Los percentiles incluyen todos los resultados terminales de la fase,
incluso fallos: se ordenan las duraciones y se interpola linealmente en `(n-1)*p`.
Una fase sin solicitudes tiene latencias `null` (`n/a` en Markdown).

El ritmo observado es iniciadas dividido por duración de la fase. Puede diferir del
techo nominal en una muestra pequeña porque el primer lote se inicia sin espera;
el criterio `rate` comprueba por separado el número de inicios en ventanas
semiabiertas de 1000 ms. Los offsets de `requests.csv` permiten auditarlo.

- Fases normales: cero errores inesperados y p95 estrictamente menor a 500 ms.
- Fase de fallos: exactamente dos 503, dos timeouts, coincidencia por solicitud
  con el plan, cero errores inesperados y recuperación final exitosa.
- Todas: sin reintentos, totales completos y límites de concurrencia/ritmo
  respetados. El p95 de `faults` incluye timeouts; no se compara con 500 ms.

Un código 503 o timeout fuera de su posición programada es inesperado. Se detiene
ante destinos inválidos, redirecciones, rutas/métodos imprevistos, fallos de
transporte, caída del servidor, errores HTTP inesperados, tres respuestas normales
consecutivas superiores a 1000 ms, interrupción o límites globales. La parada
cancela solicitudes pendientes y cierra exclusivamente el servidor propiedad del
arnés. Una fase terminada antes de una interrupción conserva sus métricas; el
resultado global de la ejecución queda `incomplete`.

## Procedimiento PowerShell

Desde la raíz de `cemydi-mobile`, con las dependencias del proyecto instaladas:

```powershell
node --version
npm run typecheck
npm run lint
npm run format:check
npm test -- --runInBand
npm run test:load
```

Para ejecutar manualmente el perfil completo después de revisar el código:

```powershell
npm run load:local
$LASTEXITCODE
```

El comando no acepta argumentos. No es necesario iniciar backend, Metro,
emulador ni aplicación. No usa `maestro-e2e.cjs`, Maestro ni ADB. No cambia la app
Android, Google Sign-In, Expo ni despliegues. Ctrl+C cancela y guarda resultados
parciales; esperar el mensaje final antes de cerrar la terminal.

Consultar la última ejecución:

```powershell
$loadRun = Get-ChildItem -LiteralPath .\test-results\load -Directory |
  Sort-Object Name -Descending |
  Select-Object -First 1
Get-Content -LiteralPath (Join-Path $loadRun.FullName 'summary.md')
$loadResults = Get-Content -LiteralPath (Join-Path $loadRun.FullName 'results.json') -Raw |
  ConvertFrom-Json
$loadResults.status
$loadResults.phases | Format-Table name, started, successful, httpErrors, timeouts, status
```

## Interpretación y evidencias de la Actividad 4

Cada ejecución crea `test-results/load/<fecha-UTC>-<sufijo-único>/`, ignorado por
Git. Nunca sobrescribe otra ejecución:

- `summary.md`: tabla legible de métricas, estado y criterios por fase.
- `results.json`: resultados completos, motivo de parada y mediciones individuales.
- `requests.csv`: una fila por solicitud iniciada, con ruta sintética, orden,
  offset, resultado, status, bytes, duración y correspondencia esperada.
- `metadata.json`: protocolo `cemydi-local-http/1`, configuración fija, entorno
  técnico sin usuario/hostname y hashes del fixture y código del arnés.

`passed` exige todas las fases completas y criterios satisfechos. `failed` indica
un perfil terminado que incumplió criterios académicos, por ejemplo p95 de 500 ms.
`incomplete` indica interrupción o fallo crítico; nunca equivale a aprobación.
Exit code: 0 para aprobado, 1 para fallo/incompleto y 130 para interrupción manual.

Para entregar la Actividad 4, conservar juntos los cuatro archivos, los resultados
de validación automática y el comando utilizado. Incorporar la tabla por fases,
comparación referencia/carga, detección de los cuatro fallos, recuperación y
conclusiones limitadas al fixture. La entrega debe identificar fecha y versión
del código evaluado. Los hashes de metadata permiten comparar fuentes aunque
haya cambios locales sin commit. No presentar la ejecución simulada de las suites
como evidencia de rendimiento real ni rellenar métricas faltantes.

## Limitaciones y tipos de prueba

Una **prueba de carga** aplica un perfil conocido y acotado para medir el
comportamiento. Una **prueba de estrés** supera gradualmente la capacidad para
buscar saturación; este arnés no la realiza. Una **prueba de tolerancia a fallos**
introduce errores conocidos y verifica detección y recuperación; aquí se limita a
503 y timeouts sintéticos, sin reintentos.

Cliente y servidor comparten proceso y equipo: CPU, antivirus, carga del sistema y
el event loop influyen en latencias. Solo se evalúa HTTP/1.1 directo sin TLS, con
conexiones sin pooling y dos productos en memoria. No se prueban red móvil,
autenticación, base de datos, Railway, servicios externos, UI, Android/iOS ni la
capacidad real del backend. Los timeouts esperados tampoco modelan una caída del
proceso del servidor; esta se cubre como parada crítica en pruebas automatizadas.

Los timers de Node.js no son tiempo real: las comprobaciones monotónicas evitan
iniciar nuevas solicitudes después del límite, pero un proceso suspendido o un
event loop bloqueado puede observar la cancelación tarde. El arnés puede guardar
parciales al recibir Ctrl+C/SIGTERM; una terminación forzada del proceso, apagado
del equipo o error de filesystem puede impedir escribir evidencias. No se inventa
un reporte aprobado en esos casos.
