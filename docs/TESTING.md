# Pruebas de CEMYDI Mobile

## Catálogo conectado — 8 de octubre de 2026

El estado vigente de Home/catálogo/detalle está en [CATALOG.md](./CATALOG.md). Home usa API pública y seis productos; catálogo acumula páginas de 24. Las referencias posteriores a Home mock corresponden al alcance histórico o a fixtures explícitos de pruebas. Carrito/autenticación siguen aislados y locales.

Validaciones de esta entrega: lint sin advertencias, typecheck, format:check y git diff --check aprobados. Jest: 30 suites y 159 pruebas aprobadas; se repitieron las suites afectadas tras los ajustes finales de presentación/vigencia de ofertas. Exportaciones Android/iOS correctas en `.tools/catalog-api-export`.

Se comprobaron contratos/serialización Zod, límite de seis, búsqueda remota, filtros confirmables/cancelables y reinicio de página, carga acumulativa/error/reintento, toques repetidos, pausa offline, detalle real/404, stock, ofertas/vencimiento y fallback de imagen. Las pruebas de muestra conservan su aislamiento mediante mocks explícitos; no son fallback de la app.

La API configurada y localhost:4000 no respondieron. Maestro fue actualizado para el catálogo remoto y el acceso directo a fixtures de carrito/detalle, pero no se ejecutó: la revisión automática rechazó abrir la ruta nueva en el emulador con `blocked by policy`. Quedan pendientes QA visual Android/iOS, fuentes grandes, lectores de pantalla y recorrido contra backend accesible. Exportar no sustituye esa comprobación.

## Alcance real

Expo SDK 57, React Native 0.86, React 19 y TypeScript estricto. Están implementados bienvenida, catálogo con búsqueda/filtros, detalle, favoritos y carrito **de muestra**, cantidades, selección, eliminación/deshacer y borradores locales de fechas/notas. El carrito vive durante la sesión del proceso: no representa precios finales, disponibilidad ni persistencia del backend.

Home consume `homeServiceMock`. Existen cliente HTTP y QueryProvider, pero no integración de negocio ni autenticación móvil terminada. Login, cupones reales, solicitudes de renta, recetas, pagos y perfil siguen pendientes. La ruta `/diagnostico` mencionada en documentación histórica no existe actualmente en `src/app`.

## Herramientas y distribución

Se conservan las herramientas elegidas: Jest 29, jest-expo 57, React Native Testing Library 14, ESLint 9, TypeScript 6, Prettier 3 y Expo Network 57 ya estaban instalados. No se agrega MSW. Expo Doctor se ejecuta con npx; Maestro es una CLI externa, no una dependencia npm. Android Studio Profiler, emuladores/dispositivos y Google Play Internal Testing requieren entorno móvil externo.

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
    http-client.test.ts
    query-network.test.tsx
  support/network-mock.ts
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

`test` ejecuta ambos proyectos Jest; `test:unit` selecciona unitarias + componentes; `test:integration` selecciona integraciones; `test:all` ejecuta ambos con `--ci`. Jest usa un máximo de dos workers. Para diagnóstico se puede añadir `--runInBand` o `--detectOpenHandles`. No se usa `--passWithNoTests`, `--forceExit` ni se ignoran errores.

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

## GitHub Actions y regresión

Dos workflows sin redundancia:

- `quality.yml`: checkout, Node 22/cache npm, npm ci, typecheck, lint, format:check y npx --yes expo-doctor.
- `tests.yml`: matriz de dos jobs independientes, unit e integration. Cada uno hace checkout, Node 22/cache, npm ci y `npm run test:<suite> -- --ci`. Unit incluye componentes. `fail-fast: false` permite obtener ambas suites; cualquier fallo hace fallar el job.

Ambos usan contents: read, timeout de 15 minutos y cancelación de runs obsoletos. Corren en PR hacia develop/main y push a esas ramas, según feature/* → develop → main. No ejecutan todo en cada push feature/* ni publican versiones/builds.

La **regresión automatizada** es repetir las mismas suites ante PR, integración y promoción a main. No se crea carpeta regression ni copias de tests. Ejecutar test:all y Quality antes de cambios importantes. La protección de ramas/checks obligatorios depende de administración de GitHub: este trabajo no accede a Projects/Issues ni asegura que se haya ejecutado un run remoto.

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
