> **Documento archivado.** contiene el registro histórico de pruebas, validaciones y evidencia local desde octubre de 2026. No describe necesariamente el estado actual. El documento vigente es [TESTING.md](../TESTING.md).\r\n\r\n# Pruebas de CEMYDI Mobile

## Mitigación de pantalla desvanecida en Android — 10 de octubre de 2026

El Stack raíz usa `animation: 'none'` en Android y fondo semántico explícito en escenas/contenedor; iOS conserva `default`. Hipótesis: transición nativa que deja el contenido parcialmente transparente, consistente con el síntoma reportado y [reportes de react-native-screens](https://github.com/software-mansion/react-native-screens/discussions/2746). No se confirmó la causa exacta ni se modificó el desenfoque de notificaciones.

Lint, typecheck, format:check y git diff --check aprobados. Jest: 35 suites aprobadas y una fallida; 189 pruebas aprobadas y tres fallidas en ProductCard. Esos tests aislados no montan el layout modificado y esperan las etiquetas anteriores «Venta y renta» / «Oferta · 15%», mientras el componente actual usa etiquetas separadas y «-15%». Fallos ajenos a esta mitigación; se conservaron los cambios locales existentes. La suite useHome emitió un aviso de actualización fuera de act.

QA nativa pendiente: `adb devices` no encontró dispositivos. En el Android afectado, recargar completamente la app y repetir Inicio → Login → Registro → Recuperación → Inicio y Catálogo → Detalle → volver, incluyendo segundo plano/retorno y toques rápidos. Comprobar contraste completo, ausencia de blanco persistente y controles operables. Sin reproducción en el teléfono no declarar resuelto el fallo. iOS visual también pendiente.

## Catálogo conectado — 8 de octubre de 2026

El estado vigente de Home/catálogo/detalle está en [CATALOG.md](../CATALOG.md). Home usa API pública y seis productos; catálogo acumula páginas de 24. Las referencias posteriores a Home mock corresponden al alcance histórico o a fixtures explícitos de pruebas. Carrito/autenticación siguen aislados y locales.

Validaciones de esta entrega: lint sin advertencias, typecheck, format:check y git diff --check aprobados. Jest: 30 suites y 159 pruebas aprobadas; se repitieron las suites afectadas tras los ajustes finales de presentación/vigencia de ofertas. Exportaciones Android/iOS correctas en `.tools/catalog-api-export`.

Se comprobaron contratos/serialización Zod, límite de seis, búsqueda remota, filtros confirmables/cancelables y reinicio de página, carga acumulativa/error/reintento, toques repetidos, pausa offline, detalle real/404, stock, ofertas/vencimiento y fallback de imagen. Las pruebas de muestra conservan su aislamiento mediante mocks explícitos; no son fallback de la app.

La API configurada y localhost:4000 no respondieron. Maestro fue actualizado para el catálogo remoto y el acceso directo a fixtures de carrito/detalle, pero no se ejecutó: la revisión automática rechazó abrir la ruta nueva en el emulador con `blocked by policy`. Quedan pendientes QA visual Android/iOS, fuentes grandes, lectores de pantalla y recorrido contra backend accesible. Exportar no sustituye esa comprobación.

## Alcance real

Expo SDK 57, React Native 0.86, React 19 y TypeScript estricto. Están implementados bienvenida, catálogo con búsqueda/filtros, detalle, favoritos y carrito **de muestra**, cantidades, selección, eliminación/deshacer y borradores locales de fechas/notas. El carrito vive durante la sesión del proceso: no representa precios finales, disponibilidad ni persistencia del backend.

Home y catálogo consumen la API pública mediante el cliente HTTP y QueryProvider. `homeServiceMock` se conserva para fixtures explícitos de pruebas de flujos de muestra. Autenticación móvil contra backend, cupones reales, solicitudes de renta, recetas, pagos y perfil conectado siguen pendientes. La ruta `/diagnostico` mencionada en documentación histórica no existe actualmente en `src/app`.

## Herramientas y distribución

Se conservan las herramientas elegidas: Jest 29, jest-expo 57, React Native Testing Library 14, ESLint 9, TypeScript 6, Prettier 3 y Expo Network 57 ya estaban instalados. Se agrega únicamente `jest-junit` 17 como dependencia de desarrollo para generar JUnit XML; requiere Node >=20 y CI conserva Node 22. No se agrega MSW. Expo Doctor se ejecuta con npx; Maestro es una CLI externa, no una dependencia npm. Android Studio Profiler, emuladores/dispositivos y Google Play Internal Testing requieren entorno móvil externo.

| Tipo de prueba                                     | Herramienta                                 | Automática/manual                | Comando/pipeline                              | Estado                                         |
| -------------------------------------------------- | ------------------------------------------- | -------------------------------- | --------------------------------------------- | ---------------------------------------------- |
| Unitarias: funciones, configuración, hooks         | Jest + jest-expo                            | Automática                       | `test:unit` / Tests: unit                     | Implementadas                                  |
| Componentes y accesibilidad observable             | Testing Library + Jest                      | Automática                       | `test:unit` / Tests: unit                     | Implementadas                                  |
| Integración de catálogo, HTTP, providers y queries | Jest + Testing Library + mocks de fetch/red | Automática                       | `test:integration` / Tests: integration       | Implementadas                                  |
| Regresión de todas las suites                      | Jest                                        | Automática                       | `test:all` / Tests en PR y push               | Implementada, sin duplicar tests               |
| Análisis estático                                  | TypeScript + ESLint + Prettier              | Automática                       | Quality                                       | Configurado                                    |
| Compatibilidad de dependencias Expo                | Expo Doctor                                 | Automática                       | `npx --yes expo-doctor` / Quality             | Configurada                                    |
| E2E de vistas de muestra Android                   | Maestro + Expo Go SDK 57                    | Automática con entorno preparado | `test:e2e` local                              | Flujos configurados; ejecución móvil pendiente |
| Pérdida física de conectividad                     | Expo Network + dispositivo/emulador         | Manual                           | Procedimiento de conectividad                 | Pendiente de ejecución                         |
| Background/foreground                              | Dispositivo/emulador                        | Manual                           | Procedimiento de segundo plano                | Pendiente de ejecución                         |
| Compatibilidad visual y nativa                     | Dispositivos/emuladores                     | Manual                           | Matriz mínima                                 | Pendiente de ejecución                         |
| Rendimiento                                        | Android Studio Profiler                     | Manual                           | Procedimiento de rendimiento                  | Pendiente de build perfilable/dispositivo      |
| Esfuerzo del cliente                               | Profiler + dispositivo/emulador             | Manual                           | Procedimiento de esfuerzo                     | Pendiente de ejecución                         |
| UAT                                                | Personas representativas del usuario        | Manual                           | Escenarios de aceptación                      | Pendiente de aceptación humana                 |
| Distribución de pruebas                            | Google Play Internal Testing                | Manual                           | Después de validaciones/aprobación de release | Pendiente; sin publicación automática          |

## Organización y comandos

```text
.github/workflows/
  quality.yml
  tests.yml
.maestro/
  config.yaml
  catalog.yaml
  product-detail.yaml
  cart.yaml
  support/open-catalog.yaml
scripts/maestro.cjs
scripts/test-summary.cjs
jest.config.js
jest.env.js
jest.setup.ts
src/
  components/ui/__tests__/controls.test.tsx
  config/__tests__/env.test.ts
  data/__tests__/product-detail-preview.test.ts
  features/cart/__tests__/                  # Pantalla y funciones puras
  features/home/__tests__/                  # Pantalla existente
  features/home/hooks/__tests__/            # useHome y errores/concurrencia
  features/products/__tests__/              # Detalle existente
  hooks/__tests__/useNetworkStatus.test.tsx
  services/http/__tests__/api-error.test.ts
tests/
  integration/
    catalog-cart.test.tsx
    guest-access.test.tsx
    http-client.test.ts
    query-network.test.tsx
  support/                                 # Fixtures y wrappers compartidos; ver inventario abajo
```

Unitarias y componentes permanecen junto al código en `src/**/__tests__`. La única estructura para nuevas integraciones es `tests/integration/`. Las pruebas existentes que combinan detalle y carrito se conservan donde estaban y se ejecutan en `unit`; no se copian ni eliminan.

```bash
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
npm test -- --ci
npm run test:unit
npm run test:integration
npm run test:all
npx --yes expo-doctor
npm run doctor
npm run check
```

`test` ejecuta ambos proyectos Jest; `test:unit` selecciona unitarias + componentes; `test:integration` selecciona integraciones; `test:all` ejecuta ambos con `--ci`. Los scripts de suites también generan JSON para el resumen, manteniendo el reportero de consola. Jest usa un máximo de dos workers por proceso. Para diagnóstico se puede añadir `--runInBand` o `--detectOpenHandles`. No se usa `--passWithNoTests`, `--forceExit` ni se ignoran errores.

`check` combina TypeScript, lint, formato y tests; Doctor se ejecuta por separado. `format` y `lint:fix` corrigen archivos y no se usan como validación CI. `.gitattributes` mantiene LF en Windows/Linux. `.tools`, reportes y coverage son artefactos ignorados, no exclusiones para esconder errores del código fuente.

## Jest, componentes e integración

Ambos proyectos comparten preset jest-expo, alias `@/`, imports directos Lucide y mock existente de Reanimated. Babel conserva su configuración de test sin NativeWind. Se valida comportamiento, no estilos nativos ni fidelidad de animaciones. Testing Library 14 requiere esperar las operaciones asíncronas de render, fireEvent, act, rerender y desmontaje. TypeScript también comprueba `tests/` y `jest.setup.ts`.

Cobertura actual:

- Fechas: formato, entradas inválidas, bisiestos y normalización; resumen ilustrativo por cantidad, selección y modalidad.
- Entorno: variables obligatorias, URL/protocolo y HTTPS en producción; selección/recomendaciones sin mutar fixtures.
- Errores: clasificación y retry de 4xx/5xx, red, timeout, parse y cancelación.
- Componentes: botón activo/disabled/loading, accesibilidad, input/feedback, empty, error/retry, loading y offline.
- Hooks: carga/refetch, error y respuestas fuera de orden de useHome; Expo Network inicial/eventos, estado desconocido y cleanup/respuestas tardías.
- Integración de vistas: Home real con hook/servicio de muestra, búsqueda sin acentos, filtros combinados, loading/error/retry y estado compartido entre catálogo/detalle/carrito/favoritos. Se comprueban llamadas de Expo Router y se renderiza el destino conservando el provider: navegación simulada, no navegación nativa.
- Integración HTTP: URL/headers/body, JSON/texto/204/multipart, errores 400/401/403/404/409/429/500/503, JSON inválido, timeout/cancelación y limpieza del listener.
- Integración QueryProvider: caché entre consumidores, pausa offline y reanudación online, retry real de red, ausencia de retry 4xx, recuperación explícita y cleanup. El consumidor de transporte es un harness de test; no agrega funcionalidades a la app.

No se crean pruebas de formularios React Hook Form/Zod sin consumidores. La validación local de fechas sí se prueba; el resumen de fixtures nunca se trata como cálculo autoritativo del backend.

### Aislamiento de red

`jest.env.js` fija siempre `EXPO_PUBLIC_API_URL=https://cemydi.test.invalid` y development antes de importar código, sin leer `.env`. `jest.setup.ts` instala por test un fetch que rechaza salvo respuesta explícita. Cada prueba de transporte aporta Response/errores: no se contacta producción, staging ni localhost.

Un mock controlado de fetch cubre el cliente real y normalizadores sin MSW. Solo se usa un spy puntual del servicio Home para error/loading; QueryProvider y CatalogPreviewProvider son reales. Expo Network se simula en su frontera nativa. Spies se restauran, llamadas se limpian y cachés/listeners se retiran; Jest no apaga Wi-Fi.

Los bodies JSON/POST/multipart son fixtures de transporte, no DTOs o endpoints nuevos. GET `/` y `Hello World!` están documentados en `API_INTEGRATION.md`, pero incluso esa respuesta se simula.

### Inventario y organización de datos de prueba

Se revisaron los cuatro archivos de integración y los cinco helpers de `tests/support/`. Se conservan las fuentes existentes y no se crean copias ni se mueven pruebas para cambiar su clasificación.

| Fuente                                                              | Responsabilidad y uso                                                                                                                                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/support/product-fixtures.ts`                                 | `productFixture` crea un objeto nuevo por llamada con cambios explícitos; `productPage` genera paginación determinista, incluida respuesta vacía con total 0. Reutilizado por servicios, hooks y componentes. |
| `tests/support/home-preview-api-mock.ts`                            | Instala explícitamente el servicio Home de muestra y ofertas vacías para recorridos aislados de autenticación/carrito. No es fallback de la app.                                                              |
| `tests/support/query-wrapper.tsx`                                   | QueryClient por montaje, sin retry y sin temporizadores de recolección para pruebas de UI; las pruebas de retry usan el QueryProvider real.                                                                   |
| `tests/support/render-with-toast.tsx`                               | Monta providers existentes, safe area determinista y el wrapper de queries; no replica lógica de Toast, autenticación o carrito.                                                                              |
| `tests/support/network-mock.ts`                                     | Estado inicial, eventos y retirada del listener Expo Network.                                                                                                                                                 |
| `src/data/catalog-preview.ts` y servicio `homeServiceMock`          | Fuente existente de productos de muestra para recorridos locales; los tests la reutilizan sin duplicar catálogo.                                                                                              |
| `tests/integration/http-client.test.ts`                             | Responses de transporte locales: 200 JSON/texto, 204 vacío, errores HTTP, parse, timeout y cancelación. Los pequeños bodies permanecen junto al caso que los necesita.                                        |
| `tests/integration/query-network.test.tsx`                          | Caché, reintentos, offline/online y recuperación con Responses explícitas y limpieza de clientes/managers.                                                                                                    |
| `tests/integration/catalog-cart.test.tsx` y `guest-access.test.tsx` | Providers reales y navegación simulada con datos de muestra; éxito, loading/error/reintento y acceso invitado.                                                                                                |

Para casos nuevos, reutilizar las factories y helpers antes de añadir datos. No mutar fixtures importados, no compartir caché entre pruebas y restaurar temporizadores/spies/listeners. Los casos vacíos/error de catálogo y contratos también se verifican en `src/` y permanecen en la suite `unit`. El aislamiento actual cubre `fetch` y fronteras nativas simuladas; cualquier transporte futuro debe recibir su propio bloqueo/mock, no una URL real. No se utilizan credenciales ni base de datos de producción.

## GitHub Actions y regresión

### Arquitectura, orden y paralelismo

Se mantienen dos workflows con responsabilidades distintas:

- `quality.yml` / job `validate`: checkout → Node 22/cache npm → `npm ci` → typecheck → lint → format:check → `npm run doctor`. La secuencia detiene las validaciones posteriores al primer error. Primero se comprueban tipos/estática/formato; Doctor queda al final porque consulta compatibilidad y puede depender de servicios externos.
- `tests.yml`: matriz independiente `unit` e `integration`. Cada job hace checkout → Node 22/cache npm → `npm ci` → `npm run test:<suite> -- --ci` → resumen → artefacto. Se conserva `fail-fast: false` para obtener la otra suite aunque falle una. Resumen y subida usan `if: always()` y se intentan también tras errores.

Quality y los dos jobs de Jest pueden ejecutarse en paralelo. No hay dependencia de pruebas respecto a Quality: un error estático no impide reunir evidencia de las suites. Las suites no comparten backend, base de datos ni estado de proceso y escriben carpetas/artefactos diferentes. Esto reduce latencia y evita que una integración fallida impida diagnosticar las unitarias. Se acepta el costo de tres instalaciones aisladas, con cache npm; no se comparten `node_modules` entre runners ni se repite `test:all` en CI.

Dentro de cada Jest se mantiene `maxWorkers: 2`: paralelismo acotado por memoria/CPU para las transformaciones Expo. Las pruebas de un mismo archivo siguen siendo secuenciales, salvo un `test.concurrent` explícito. `--runInBand` queda para diagnóstico local de orden/timers, no como solución para esconder fallos. No se cambia cobertura, filtros de pruebas ni aserciones.

### Eventos y ejecuciones duplicadas

| Evento                                                     | Ramas                      | Resultado esperado                                                                                             |
| ---------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pull_request` (opened, synchronize, reopened por defecto) | Destino `develop` o `main` | Quality y ambas suites comprueban el commit de merge de prueba del PR. Un nuevo push al PR vuelve a validarlo. |
| `push`                                                     | `develop` o `main`         | Quality y ambas suites verifican el estado integrado. Un merge hacia `develop` es este evento push.            |
| `push` a `feature/*` u otra rama de trabajo                | Sin PR                     | No inicia estos workflows; ejecutar los comandos locales antes de abrir el PR.                                 |
| Cierre/merge de PR                                         | —                          | No se agrega `pull_request: closed`: el push de integración ya realiza la comprobación.                        |

No se duplica push de una feature con el evento del PR, ni se agrega un workflow extra de merge. Cada workflow cancela runs obsoletos del mismo ref con su grupo de `concurrency`; Quality y Tests no se cancelan entre sí. PR y push a una rama protegida validan estados distintos y se conservan ambos. Durante un PR `develop` → `main`, un push a develop también puede activar el PR: es una validación de la integración de develop y otra de su combinación con main, no se elimina ninguna.

Ambos workflows mantienen `contents: read` y timeout de 15 minutos por job. No requieren secretos, comentarios de PR, publicación ni permisos de escritura.

### Resultado real y reportes automáticos

El reportero global de `jest.config.js` conserva `default` y agrega [jest-junit](https://github.com/jest-community/jest-junit). Se configura en la raíz porque Jest no admite reporteros independientes por proyecto. `npm_lifecycle_event` selecciona la carpeta para los scripts unit/integration; `npm test`, `test:all` y una invocación directa de Jest usan `all/junit.xml` combinado.

```text
test-results/jest/
  unit/
    junit.xml
    results.json
    summary.md
  integration/
    junit.xml
    results.json
    summary.md
  all/junit.xml                  # Solo al ejecutar ambas suites juntas
```

`test-results/` ya está ignorada por Git, ESLint y Prettier. No hay commits automáticos ni reportes versionados. Cada ejecución que llega a producir resultados sobrescribe los reportes locales de su suite; no representan un historial. Si una ejecución local falla antes de generar reportes, pueden quedar archivos anteriores: comprobar timestamps/logs y no atribuirlos al intento fallido. CI usa un checkout limpio en cada job. Los nombres de artefacto `jest-unit-<run_attempt>` y `jest-integration-<run_attempt>` evitan colisiones entre jobs y reintentos.

Jest exitoso devuelve 0; una aserción fallida, suite que no carga o ausencia de pruebas devuelve un código distinto de 0 y hace fallar el job. No hay `continue-on-error`, `--passWithNoTests`, `--forceExit`, reintentos automáticos de tests ni wrappers que conviertan errores en éxito. `reportTestSuiteErrors` incluye fallos de carga de suites en XML. `fail-fast: false` deja terminar la otra suite y no modifica el resultado fallido.

`scripts/test-summary.cjs` lee el JSON real, verifica que exista JUnit y crea una tabla de suites/pruebas aprobadas, fallidas, pendientes y todo; enumera hasta diez archivos con fallos. Escribe `summary.md` y agrega el mismo texto a `GITHUB_STEP_SUMMARY`. Si Jest falla, el resumen también devuelve error. Si el paso informó éxito pero faltan reportes o hay cero pruebas, el resumen falla para evitar evidencia falsamente aprobada. Si la instalación falló y Jest fue omitido, el resumen indica ausencia de evidencia y conserva el fallo original.

La subida con [actions/upload-artifact@v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2) conserva XML, JSON y resumen durante 14 días, incluso con pruebas fallidas. Si no llegó a ejecutarse Jest puede existir solo el resumen; nunca se etiqueta como aprobado. Un runner perdido, cancelación forzada, timeout o fallo antes de checkout puede impedir producir/subir evidencia: `always()` es un intento, no garantía de reportes que no se generaron.

Para consultar: GitHub → Actions → ejecución Quality/Tests del PR o push → revisar estado/log de cada job y sección Summary. En la ejecución Tests, descargar los artefactos `jest-unit-*` y `jest-integration-*` desde Artifacts; abrir `summary.md` o importar `junit.xml` en un lector JUnit. GitHub conserva el log del paso con los detalles, y el JSON contiene los mensajes completos. No se publica un comentario automático en el PR.

Para generar/consultar localmente:

```bash
npm run test:unit -- --ci
npm run test:integration -- --ci
node scripts/test-summary.cjs unit
node scripts/test-summary.cjs integration
```

La **regresión automatizada** repite las mismas suites ante PR, integración y promoción a main. No se crea carpeta regression ni copias de tests. `test:all` sirve para regresión local; no genera los dos artefactos separados.

### Configuración manual y límites

En rulesets/protección de `develop` y `main`, exigir Pull Request, revisión y los tres checks de GitHub Actions: `validate` (workflow Quality), `unit` e `integration` (workflow Tests). Elegir los nombres exactos que GitHub muestre tras el primer run; no usar solo el nombre del workflow. `validate` incluye TypeScript, lint, formato y Doctor. Exigir rama actualizada antes de merge según la política del equipo y restringir bypass/push directo; configurar esto requiere administración de GitHub.

Habilitar Actions y las acciones utilizadas (`checkout@v7.0.1`, `setup-node@v7.1.0`, `upload-artifact@v7.0.2`); permitir retención de 14 días. No se necesita permiso `checks: write`. Los PR desde forks pueden requerir aprobación manual del primer run. Si se habilita merge queue, añadir `merge_group` a ambos workflows antes de usarla; no está configurada en esta actividad.

Queda pendiente comprobar en GitHub un PR real exitoso y uno con fallo controlado, descarga de artefactos y bloqueo de merge por checks. Esta actividad solo valida configuración/comandos localmente: no crea PR, no hace push/merge, no configura protección remota ni modifica historial. E2E móvil, QA Android/iOS, servicios Expo y comportamiento de un runner remoto requieren su entorno. No se implementan EAS Build ni Google Play.

### Evidencia local de la mejora CI — 14 de octubre de 2026

Repositorio revisado: `cemydi-mobile`, rama existente `fix/expo-sdk-dependencies`; working tree inicialmente limpio. Se conservó la rama y no se ejecutaron operaciones de versionamiento. Entorno local: Windows, Node 24.11.0 y npm 11.12.1; Expo instalado 57.0.28. CI conserva Ubuntu/Node 22: los resultados locales no sustituyen un run remoto.

| Validación                         | Resultado observado                                                                                                                                                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci` con lock actualizado      | Código 0; instalación reproducible. Advertencias existentes de peers React/test-renderer y paquetes obsoletos. Auditoría automática: 75 vulnerabilidades (20 moderadas, 54 altas, 1 crítica), también observadas antes del cambio; no se ejecutó audit fix ni se ampliaron actualizaciones. |
| `npm run typecheck`                | Código 0.                                                                                                                                                                                                                                                                                   |
| `npm run format:check`             | Código 0.                                                                                                                                                                                                                                                                                   |
| `npm run test:unit -- --ci`        | Código 0: 32 suites, 168 pruebas aprobadas, sin omitidas ni todo; 43.172 s en la ejecución final tras npm ci.                                                                                                                                                                               |
| `npm run test:integration -- --ci` | Código 0: 4 suites, 25 pruebas aprobadas, sin omitidas ni todo; 29.898 s en la ejecución final tras npm ci.                                                                                                                                                                                 |
| `npm run doctor`                   | Código 0: 21/21 comprobaciones aprobadas.                                                                                                                                                                                                                                                   |
| Resúmenes y XML                    | Resumen por suite generado; XML parseados con el lector XML de PowerShell: unit 168 tests/0 failures/0 errors; integration 25/0/0. Git confirma que los reportes están ignorados.                                                                                                           |
| YAML e invariantes de workflows    | Parseo sin errores/claves duplicadas; comprobados eventos/ramas, secuencia, matriz, ausencia de tolerancia a errores, jobs independientes y pasos de evidencia con always. No sustituye la evaluación de GitHub Actions.                                                                    |

La validación final de `npm run lint` devolvió código 0, sin errores ni advertencias. La primera ejecución detectó `no-undef` para `__dirname` en el nuevo script CommonJS; se corrigió declarando el global de Node y se repitió lint completo. `git diff --check` también pasó.

La primera ejecución también pasó (168 + 25 pruebas) y emitió el aviso preexistente de VirtualizedList fuera de `act`, ya registrado en este documento. La ejecución final no lo emitió; no se silenció ni se cambió código/pruebas de la app.

Se ejecutó una sonda aislada bajo `.tools/ci-report-probe/`, ignorada por Git, con el mismo reportero/configuración global y una copia del script de resumen. No se añadieron fallos a las suites existentes. Éxito: Jest/resumen 0 y XML con 2 tests, 0 failures, 0 errors. Aserción fallida: Jest/resumen 1, JSON success=false y XML con 2 tests/1 failure. Error de carga: Jest/resumen 1 y XML con 1 error. JSON ausente/inválido o JUnit ausente tras supuesto éxito: resumen 1; tests omitidos antes de iniciar: resumen 0 con ausencia de evidencia explícita y sin modificar el fallo previo del job. Se comprobó la escritura de GITHUB_STEP_SUMMARY.

Una ejecución controlada sin coincidencias de tests también devolvió código 1. Las sondas se pueden repetir con `node .tools/ci-report-probe/verify.cjs` y `node .tools/ci-report-probe/check-workflows.cjs` en este checkout; son herramientas de evidencia local ignoradas, no suites adicionales de la app.

Las evidencias locales de la sonda quedan en `.tools/ci-report-probe/` y los resultados reales en `test-results/jest/{unit,integration}/`. Los archivos generados no forman parte del diff. Pendiente exclusivamente remoto para este alcance: runs reales en Ubuntu/Node 22, subida/descarga de artefactos y branch protection con bloqueo de merge. No se intentaron push, PR o merge para validarlos.

### Actualización del runtime de acciones — 14 de octubre de 2026

Los workflows fijan `runs-on: ubuntu-24.04` y versiones completas de las acciones para evitar cambios automáticos de versión mayor. Se verificaron releases oficiales estables (sin draft/prerelease) y sus manifiestos `action.yml`:

| Acción          | Versión fijada | Runtime del manifiesto | Fuente oficial                                                            |
| --------------- | -------------- | ---------------------- | ------------------------------------------------------------------------- |
| checkout        | `v7.0.1`       | `node24`               | [Release](https://github.com/actions/checkout/releases/tag/v7.0.1)        |
| setup-node      | `v7.1.0`       | `node24`               | [Release](https://github.com/actions/setup-node/releases/tag/v7.1.0)      |
| upload-artifact | `v7.0.2`       | `node24`               | [Release](https://github.com/actions/upload-artifact/releases/tag/v7.0.2) |

El runtime interno de las acciones es independiente de `node-version: 22`: los comandos npm del proyecto siguen usando Node 22. `setup-node` admite ese major y `cache: npm`; los inputs de upload (nombre, ruta, retención y archivos ausentes) siguen admitidos y `archive` conserva su valor predeterminado true. No se cambian nombres de checks, eventos, permisos, paralelismo, Jest, JUnit ni scripts de reportes.

Se revisaron las notas de migración: checkout v7 restringe código de forks en `pull_request_target`/`workflow_run`, eventos que estos workflows no utilizan; setup-node v7 retira el token ficticio para configuraciones de registry, que aquí no se utilizan. El runtime Node 24 requiere runner >=2.327.1, según [setup-node](https://github.com/actions/setup-node/blob/v7.1.0/README.md). Se utiliza el runner hospedado de GitHub con la [etiqueta Ubuntu 24.04](https://docs.github.com/en/actions/reference/runners/github-hosted-runners). Fijar la etiqueta del sistema operativo no congela las actualizaciones de paquetes de la imagen, ni `22` congela el patch de Node.

La comprobación local ignorada `.tools/ci-report-probe/check-workflows.cjs` ahora verifica las tres versiones, Ubuntu 24.04, Node 22 y cache npm; se corrigió su expectativa de upload-artifact v4. Se añadió `.tools/ci-report-probe/check-action-runtime.cjs` para contrastar versiones estables, runtime Node 24 e inputs contra los manifiestos oficiales, sin instalar dependencias.

Validación en Windows/Node 24.11.0/npm 11.12.1, rama existente `feature/ci-testing-improvements`, working tree inicialmente limpio:

| Comando                                                | Resultado real                                                                                                                                      |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node .tools/ci-report-probe/check-workflows.cjs`      | Código 0: YAML sin errores/claves duplicadas e invariantes aprobadas.                                                                               |
| `node .tools/ci-report-probe/check-action-runtime.cjs` | Código 0: las tres releases son estables, usan node24 y admiten todos los inputs actuales; ZIP predeterminado conservado. Requiere acceso a GitHub. |
| `npm run typecheck`                                    | Código 0.                                                                                                                                           |
| `npm run lint`                                         | Código 0, sin errores ni advertencias.                                                                                                              |
| `npm run format:check`                                 | Código 0.                                                                                                                                           |
| `npm run test:unit -- --ci`                            | Código 0: 32 suites/168 pruebas aprobadas, 26.605 s. Aviso de HookContainer fuera de act en useHome, ya documentado históricamente; no se silenció. |
| `npm run test:integration -- --ci`                     | Código 0: 4 suites/25 pruebas aprobadas, 13.455 s.                                                                                                  |
| `npm run doctor`                                       | Código 0: 21/21 checks aprobados.                                                                                                                   |
| `git diff --check`                                     | Código 0.                                                                                                                                           |

No se repitió `npm ci`: package.json, lock y dependencias no cambiaron y la instalación existente permitió ejecutar todas las validaciones. actionlint no está instalado; se verificó sintaxis YAML, invariantes e inputs oficiales, sin afirmar una ejecución de GitHub Actions local.

El usuario informó que los tres checks del PR #136 y los reportes existentes ya aprobaron. Queda pendiente un nuevo run remoto con estas versiones para confirmar la desaparición de advertencias, checkout/cache y subida de artefactos en Ubuntu 24.04/Node 22. No se hace push, se crea PR ni se modifica el historial para provocarlo. Todos los cambios quedan sin confirmar.

## Maestro local Android

Tres flows solo sobre funciones existentes: catálogo/búsqueda/limpieza; detalle/modalidades/favorito; carrito de compra/cantidad/eliminar/deshacer. Sin login ni envío de renta. Usan textos/accessibilityLabels existentes, sin testIDs nuevos ni cambios visuales.

El entorno actual es **Expo Go Android**, appId `host.exp.exponent`. No se inventa un identificador nativo CEMYDI. app.json no define android.package, ios.bundleIdentifier, EAS ni build APK. Cada flow reinicia Expo Go y abre `/inicio` con una sesión nueva; config.yaml lista solo los tres flows principales y excluye el subflow compartido.

Requisitos: Java 17+, Maestro CLI, ADB, emulador/dispositivo autorizado, Expo Go compatible con SDK 57 y Metro accesible. Abrir previamente el proyecto una vez para resolver avisos/permisos iniciales y errores Metro. Maestro 2.11.0 está instalado localmente en `.tools/maestro/maestro`, ignorado por Git; otros clones deben instalarlo. El launcher npm llama el entry point oficial mediante Java, pasa argumentos sin shell y propaga exit codes. No cambia el PATH global.

Instalación desde raíz en PowerShell (la descarga latest puede cambiar de versión; comprobarla):

```powershell
New-Item -ItemType Directory -Force -Path .tools | Out-Null
Invoke-WebRequest -Uri 'https://github.com/mobile-dev-inc/maestro/releases/latest/download/maestro.zip' -OutFile .tools/maestro.zip
Expand-Archive -LiteralPath .tools/maestro.zip -DestinationPath .tools/maestro -Force
java -version
npm run maestro -- --version
```

En macOS/Linux descomprimir la distribución en esa carpeta o definir `CEMYDI_MAESTRO_HOME` con la instalación que contenga lib/. Consultar [instalación oficial](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli). El launcher desactiva analítica y avisos de CLI.

Preparar Android/Metro:

```bash
adb devices
adb reverse tcp:8081 tcp:8081
npm run start:local
```

Desde otra terminal:

```bash
npm run test:e2e
npm run test:e2e -- --format JUNIT --output test-results/maestro.xml
npm run maestro -- test .maestro/cart.yaml
```

start:local mantiene Metro limitado a localhost y prioriza IPv4, para que ADB reverse pueda acceder a 127.0.0.1 también en Windows con localhost resuelto primero a IPv6. Mantener un solo Metro por puerto y recargar completamente Expo Go después de cambios en el grafo de módulos.

EXPO_URL tiene default exp://127.0.0.1:8081 en openLink, sin una constante del subflujo que sobrescriba el parámetro CLI. Para otro puerto local, iniciar Metro y configurar reverse para ese mismo puerto; por ejemplo:

```bash
npm run start:local -- --port 8082
adb reverse tcp:8082 tcp:8082
npm run test:e2e -- -e EXPO_URL=exp://127.0.0.1:8082
```

Sustituir la dirección de ejemplo por la URL mostrada por Expo. Con varios dispositivos añadir `--device <id>`. La sintaxis [openLink](https://docs.maestro.dev/reference/commands-available/openlink) abre el proyecto servido por Metro. Selectores regex de producto usan el label real, sin coordenadas.

**Validación disponible:** CLI instalada y comando npm comprobado. adb devices no mostró dispositivos; test:e2e devuelve error por ausencia de dispositivo. No se declara ningún flow aprobado: scroll, tiempos y aserciones requieren ejecución móvil.

**E2E CI pendiente:** no se añade un workflow Android sin build definido. Después aprobar identificadores/build, producir artefacto instalable, preparar emulador estable, sustituir Expo Go por appId confirmado y ejecutar Maestro con reportes. Primero validar localmente. iOS requiere entorno real macOS/simulador y preparación propia.

## Conectividad manual

1. Registrar dispositivo/OS, commit/build y red. Abrir catálogo, detalle y carrito.
2. Apagar Wi-Fi/datos o activar modo avión desde el dispositivo/emulador; repetir inicio offline y pérdida durante navegación.
3. Verificar ausencia de cierres/bloqueos y conservación del carrito en el mismo proceso. Home usa fixtures e imágenes locales: funcionar offline no demuestra conexión al backend.
4. Recuperar red y repetir navegación; registrar tiempos/mensajes.
5. Cuando exista una pantalla con queries reales, verificar pérdida durante consulta, error/retry y refetch al reconectar contra backend de pruebas autorizado. Uploads/mutaciones reales aún están pendientes.

Evidencia: video/capturas, timestamps y logs sin datos personales. Jest verifica eventos simulados; esta prueba valida OS, permisos y red física. Expo Network ya conecta onlineManager en QueryProvider; useNetworkStatus todavía no tiene consumidores de pantalla. No se agrega un indicador offline a Home para fingir dependencia de red.

## Segundo plano manual

1. Abrir app, navegar a detalle/carrito y añadir cantidades/favorito o un borrador.
2. Capturar estado y enviar a segundo plano con Home/cambio de app.
3. Esperar 30 segundos, regresar y revisar pantalla/estado sin cierre inesperado.
4. Repetir con cinco minutos y cambiando conectividad durante la espera.
5. Distinguir retorno al mismo proceso de terminación por el OS: el carrito actual no persiste y puede reiniciarse si el proceso muere; no equivale a perder sesión autenticada.

Evidencia: video, duración, OS, logs y si hubo recreación del proceso. Cuando existan queries reales verificar refetch al recuperar foco. Background y supervivencia del proceso no se prueban artificialmente con Jest.

## Compatibilidad mínima

| Entorno objetivo           | Configuración                                 | Comprobaciones                                | Resultado                          |
| -------------------------- | --------------------------------------------- | --------------------------------------------- | ---------------------------------- |
| Emulador Android pequeño   | 320–360 dp aprox.; OS compatible con SDK 57   | Scroll, columna única, teclado/safe areas     | Pendiente; no ejecutado            |
| Emulador Android mediano   | 390–430 dp aprox.; OS compatible con SDK 57   | Dos columnas, detalle, carrito/modales        | Pendiente; no ejecutado            |
| Dispositivo físico Android | Un equipo disponible, registrar modelo/OS     | Red, fluidez, memoria y lifecycle             | Pendiente; no ejecutado            |
| iOS                        | Solo con acceso real a Mac/simulador o iPhone | Navegación, teclado, safe areas/red/lifecycle | Pendiente de entorno; no ejecutado |

En cada entorno repetir con fuente predeterminada/aumentada, TalkBack/VoiceOver cuando corresponda, portrait actual, texto largo, teclado abierto y estados loading/empty/error. Jest no valida estilos NativeWind. Tablet queda pendiente de soporte formal aunque supportsTablet esté habilitado. No atribuir resultados a equipos no probados.

## Rendimiento manual con Android Studio Profiler

Expo Go permite observaciones exploratorias, pero mezcla costo del contenedor/desarrollo. Para evidencia propia preparar mediante CNG una build Android debuggable/profileable con identificador aprobado; no editar proyectos nativos manualmente ni publicar. Sin build/dispositivo no declarar resultados Profiler.

1. Registrar build/commit, modelo/API Android, modo de build, red y temperatura. Cerrar apps ajenas y conectar el proceso correcto a Profiler.
2. Calentar dos minutos y medir memoria/CPU en reposo y apertura del catálogo.
3. Recorrer catálogo/imágenes, buscar/filtrar, abrir detalle, cambiar modalidades/fotos y regresar. Repetir diez ciclos con ritmo comparable.
4. Observar picos CPU, memoria al volver al mismo punto, pausas/jank y respuesta de teclado/scroll. Usar trazado disponible para fluidez; no deducir FPS de Jest.
5. Continuar 15 minutos y comparar memoria después de reposo con baseline del mismo equipo/build; revisar cleanup de listeners/timers/imágenes.

Guardar capturas/trazas/exportaciones Profiler, video y mediciones con unidades/intervalos. Reportar diferencias reproducibles, cierres y ANR. Establecer umbrales cuando exista baseline medido: no inventar MB, CPU, FPS o límites de aprobación.

## Esfuerzo manual del cliente

Sesión de 30 minutos y al menos 50 ciclos catálogo → detalle → carrito → catálogo: búsquedas/filtros repetidos, añadir/quitar, cantidades, eliminar/deshacer y editar borradores. Respetar límites del carrito; registrar ciclos logrados y motivo de interrupción.

Home no consulta la API: repetir búsqueda/refetch prueba cliente/fixtures, no carga del servidor. Cuando exista API de pruebas autorizada, medir consultas repetidas dentro de límites acordados; nunca estrés contra producción.

Evidencia: duración/pasos, video, logs/ANR/crashes, errores de interacción y trazas CPU/memoria antes/durante/después. Revisar degradación creciente y conservación de estado en el mismo proceso. Es una prueba manual observada con Profiler, no un test Jest.

## UAT y distribución

UAT es aceptación humana desde la perspectiva del usuario. Pedir que encuentre equipo, distinga compra/renta, interprete precios ilustrativos, añada al carrito, cambie cantidad, deshaga una eliminación y guarde fechas. Registrar tarea, expectativa/resultado, dudas, defectos y aprobación explícita. Cuenta, pago y envío de renta son pendientes funcionales, no casos aprobados.

**Maestro no equivale a UAT**: sus recorridos detectan regresiones mecánicas, pero no demuestran comprensión/utilidad/aceptación. UAT permanece pendiente hasta ejecución humana real.

Google Play Internal Testing se utilizará después de Quality, suites/integraciones y validaciones móviles satisfactorias, además de preparación/aprobación manual de release. Requiere build firmada, identificador, acceso a consola y testers. No hay publicación automática ni deploy. Cuando ocurra, registrar versión/commit, cohorte, feedback y aceptación.

## Evidencia y cierre

Usar registro manual con fecha/responsable, dispositivo/OS, commit/build, escenario/precondiciones, pasos, esperado/observado, aprobado/fallido y enlace a evidencia, sin secretos/datos personales. Pendiente nunca significa aprobado.

Los recursos y pipelines ejecutables por el repositorio quedan implementados. E2E móvil, compatibilidad, rendimiento, esfuerzo, segundo plano, UAT, distribución e integraciones de negocio dependen del entorno o funcionalidad correspondiente. Ver `TESTING_SETUP_REPORT.md` para inventario y validación de esta configuración.

## Auditoría correctiva de UX, arquitectura y rendimiento — 8 de octubre de 2026

Baseline antes de esta revisión: lint, typecheck, format:check y 120 tests / 21 suites aprobados. El working tree ya contenía cambios de autenticación, toast, carrito e imágenes; no se atribuyen a esta auditoría ni se revierten.

Correcciones: imports directos en lugar de cinco reexports vacíos de Home; Skeleton reutilizable con CatalogSkeleton durante la carga sin datos; CatalogImage con BlurHash opcional por imagen remota, placeholder neutro, caché, reciclaje y recuperación al cambiar origen; eliminación de fotos duplicadas y montaje diferido del zoom; callbacks y resultados derivados estables; contexto de acciones de carrito y tarjetas memoizadas; temporizador OTP aislado; borradores no secretos al corregir correo; ajuste único de teclado según intersección; escalado de onboarding y controles con AppButton; bloqueo inmediato al compartir; imports directos de fuentes.

Pruebas de regresión añadidas: fallback y cambio de origen de imágenes, hash opcional y recursos locales; deduplicación, caché tras desmontar y mocks offline; omisión del render de otras imágenes al cambiar selección/cantidad; galería real con selección y zoom; conservación del correo al regresar desde OTP; espacio de teclado con viewport completo/redimensionado y cleanup de listeners. Las integraciones existentes siguen comprobando filtros, cantidades, resumen, favoritos, deshacer y acceso invitado.

Resultado final: `npm run typecheck`, `npm run lint`, `npm run format:check` y `git diff --check` aprobados; Jest con `npm test -- --runInBand`: 23 suites y 130 pruebas aprobadas. Jest requiere ejecución fuera del sandbox por EPERM de Windows al resolver realpath. La suite de carrito emitió un aviso intermitente de actualización de VirtualizedList fuera de act; no se silenciaron advertencias. Las aserciones y la prueba explícita de aislamiento de tarjetas pasan. No equivale a QA nativa.

Imágenes: se inspeccionaron 19 PNG no legacy, sin redimensionar ni convertir formatos. Solo seis recursos activos mejoraron mediante recompresión: logo horizontal (203608 → 192087 bytes), adaptive foreground (15765 → 14167), monochrome (11563 → 9388), app icon (14319 → 13223), favicon (730 → 662), splash (19651 → 18728). Ahorro total: 17381 bytes respecto al working tree inicial; igualdad RGBA y dimensiones verificada con Pillow, conservando metadatos de color. Auth, catálogo y onboarding ya tenían compresión conveniente y no se modificaron en esta revisión. Las variantes de marca sin referencias activas se conservaron. Las grandes diferencias de esos assets frente a Git HEAD eran preexistentes.

Compatibilidad: Expo instalado 57.0.27, expo-image 57.0.5, React Native 0.86.3 y Reanimated 4.5.1. Expo Doctor: 21/21 comprobaciones aprobadas. Expo install --check informó dependencias compatibles usando el mapa local al estar deshabilitada su red; Doctor aporta la comprobación adicional. No se añadieron dependencias.

Exportaciones Android/iOS correctas con `npx expo export --platform android --platform ios --output-dir .tools/audit-font-export`; resolución de imports, assets y compilación Hermes verificadas. Imports directos de Inter excluyen 14 variantes que aparecían en `.tools/audit-native-export`, con 4844592 bytes menos de assets de fuente por plataforma sin comprimir. No mide APK, memoria ni fluidez. Una exportación inicial con --platform all falló por react-native-web ausente, limitación web preexistente documentada; se verificaron después exclusivamente las plataformas móviles.

Validación nativa pendiente: ADB enumeró emulator-5554 y boot_completed=1, pero Maestro falló antes de ejecutar flujos con `cmd: Failure calling service package: Broken pipe (32)`; dumpsys window agotó 10000 ms. No hay recorridos, capturas ni QA visual nuevos aprobados. No se reinició/borró el emulador ni se modificó su configuración. iOS visual, fuentes grandes, TalkBack/VoiceOver, teclado, cambio de columnas y profiling requieren entorno nativo funcional; los resultados históricos no validan estos cambios.

Decisiones que no exigían cambios: encabezados por pantalla y barras inferiores actuales; stores de Toast/Query ya estables; imágenes locales RN sin BlurHash; sin Skeleton en detalle/carrito sincrónicos; sin infraestructura global de red/error ni endpoints ficticios. API pendiente: contratos y adapters, transporte de sesión aprobado, hashes/tamaños reales de imagen, políticas de queries/mutaciones, invalidación, retry y estados de conectividad donde se consuman datos remotos. Véanse ARCHITECTURE.md, DESIGN_SYSTEM.md y CONVENTIONS.md para las reglas permanentes.

## Ajuste solicitado: Home gradual y BlurHash local — 8 de octubre de 2026

Este ajuste sustituye las decisiones anteriores sobre CatalogSkeleton e imágenes locales sin placeholder. Home conserva cabecera, buscador y navegación durante la consulta; muestra un indicador proporcional y revela banners, categorías y filtros mediante opacidad, con movimiento reducido respetado. No anima las filas recicladas ni simula latencia. Error/reintento y contenido de refetch se conservan.

CatalogImage resuelve hashes propios para los 14 recursos locales activos (catálogo, onboarding, autenticación y logo), generados previamente con Pillow. La transición de 150 ms no fuerza una espera y se desactiva con movimiento reducido. Se conservan tamaños, recortes y archivos originales; no cambian dependencias móviles, contratos ni sesión.

Validación: lint, typecheck, format:check, git diff --check y 132 pruebas en 23 suites aprobados. Las pruebas comprueban cabecera/buscador utilizables mientras llega la consulta, ausencia de falso estado vacío, reintento, hash distinto por foto, cambio de origen/contentFit, fallback y movimiento reducido. `python scripts/generate-image-placeholders.py --check` verificó los 14 hashes y checksums. Exportación Android/iOS correcta en `.tools/home-blurhash-export`.

QA visual nativa pendiente: ADB y el Metro existente responden, pero Expo Go quedó en blanco durante el intento con `.maestro/catalog.yaml`. Maestro falló tras 2 min 28 s al no encontrar «Buscar equipo ortopédico»; reporte en `.tools/home-blurhash-maestro.xml` y captura en `.tools/home-blurhash-current.png`. Los logs muestran inicialización nativa lenta y `Cannot get UIManager because the context doesn't contain an active React instance`; no se observó la pantalla de catálogo. No se atribuye una causa definitiva ni se considera aprobado el recorrido. iOS visual también pendiente; exportar bundles y pasar Jest no valida el aspecto de las transiciones.
