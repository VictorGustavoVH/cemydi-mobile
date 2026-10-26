# Pruebas de CEMYDI Mobile

## Alcance

Este documento describe la estrategia de pruebas vigente, los comandos y las verificaciones manuales que Jest no puede sustituir. La integración de pestañas, push y onboarding se documenta en [MOBILE_QUALITY.md](./MOBILE_QUALITY.md). El registro histórico de ejecuciones y evidencias anteriores está en [archive/TESTING_HISTORY.md](./archive/TESTING_HISTORY.md).

Principios:

- Jest valida comportamiento, contratos y estados; no valida estilos nativos, fluidez ni fidelidad visual.
- Una exportación correcta o una suite verde no equivalen a QA en dispositivo.
- Los fallos no se ocultan con `--passWithNoTests`, `--forceExit`, `continue-on-error` ni reintentos automáticos.
- Los contratos se prueban contra fixtures explícitos, nunca contra producción.

## Herramientas

| Área                            | Herramienta                                |
| ------------------------------- | ------------------------------------------ |
| Unitarias y componentes         | Jest 29 + jest-expo 57                     |
| Componentes y accesibilidad     | React Native Testing Library 14            |
| Integración de providers y HTTP | Jest + fetch mockeado                      |
| Reportes                        | jest-junit 17 + `scripts/test-summary.cjs` |
| Análisis estático               | TypeScript 6, ESLint 9 y Prettier 3        |
| Compatibilidad Expo             | Expo Doctor                                |
| E2E Android                     | Maestro sobre development build            |
| Rendimiento manual              | Android Studio Profiler                    |

Maestro es una CLI externa, no una dependencia npm. Android Studio, emuladores, dispositivos y Google Play requieren entorno externo.

## Organización

```text
.github/workflows/
  quality.yml              # typecheck, lint, format y Expo Doctor
  tests.yml                # Jest/infraestructura → build Android → Maestro → e2e
.maestro/
  config.yaml
  catalog.yaml
  product-detail.yaml
  cart.yaml
  onboarding.yaml
  tabs.yaml
  support/open-app.yaml
  support/open-catalog.yaml
  support/open-test-product.yaml
scripts/
  android.cjs
  maestro.cjs
  maestro-e2e.cjs
  maestro-ci.sh
  maestro-ci.test.cjs
  test-summary.cjs
jest.config.js
jest.env.js
jest.setup.ts
src/**/__tests__/          # Unitarias y componentes junto al código
tests/
  integration/             # Integración entre features, providers y HTTP
  support/                 # Fixtures, mocks de API y wrappers
```

`jest.config.js` define dos proyectos:

- `unit`: archivos `src/**/*.test.[jt]s?(x)`.
- `integration`: archivos `tests/integration/**/*.test.[jt]s?(x)`.

Ambos comparten el preset `jest-expo`, el alias `@/`, el mapeo de iconos Lucide y `maxWorkers: 2`.

La configuración raíz de Jest usa `testTimeout: 15_000` porque la suite de integración renderiza pantallas completas y compite por CPU con la unitaria. El valor por defecto de 5 s producía fallos intermitentes por contención de recursos, no por bloqueos del flujo; no se usan reintentos ni `--forceExit`.

## Comandos

```bash
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:unit
npm run test:integration
npm run test:all
npm run check
npx --yes expo-doctor
```

- `test`: ambos proyectos.
- `test:unit`: unitarias y componentes; genera JSON/JUnit en `test-results/jest/unit/`.
- `test:integration`: integración; genera JSON/JUnit en `test-results/jest/integration/`.
- `test:all`: ambos proyectos con `--ci`.
- `check`: typecheck + lint + format + tests.
- `format` y `lint:fix` corrigen archivos; no se usan como validación de CI.

Para diagnosticar orden, timers o handles abiertos:

```bash
npm test -- --runInBand
npm test -- --detectOpenHandles
```

`test-results/` está ignorado por Git, ESLint y Prettier. Los reportes se sobrescriben en cada ejecución y no son historial.

## Aislamiento de red y datos

- `jest.env.js` fija `EXPO_PUBLIC_API_URL=https://cemydi.test.invalid` y `EXPO_PUBLIC_APP_ENV=development` antes de importar código. No lee `.env`.
- `jest.setup.ts` instala un `fetch` que rechaza salvo que la prueba aporte una respuesta explícita.
- También sustituye SecureStore por un mapa en memoria y mockea Reanimated, worklets, blur y safe area cuando corresponde.
- Nunca se contacta producción, staging, localhost ni un backend real.
- Los bodies JSON y multipart son fixtures de transporte, no DTOs o endpoints nuevos.
- Cada prueba limpia componentes, spies y cachés; no se comparte estado entre casos.

Fixtures compartidos en `tests/support`:

- productos y paginación;
- respuestas de autenticación, carrito, cuenta y perfil;
- estado de red;
- QueryClient por montaje;
- wrappers de Toast y providers;
- harness de carrito conectado.

## Cobertura funcional actual

Las suites cubren, entre otros:

- **Autenticación:** login, registro, recuperación, OTP, Google, restauración, refresh, logout, cambio de correo/contraseña y destinos internos.
- **Catálogo:** contratos de productos, listado, búsqueda, filtros, paginación, detalle, reseñas, recomendaciones, ofertas, caché y errores.
- **Home:** carga, límite de productos, banners, errores, concurrencia y refetch.
- **Carrito:** servicio, adapters, resumen, cupones, cantidades, fechas/notas, carrito invitado y carrito conectado.
- **Favoritos:** listado, ids, toggle y sincronización con tarjetas.
- **Perfil y cuenta:** perfil, rentas, cancelación, reseñas y documentos legales.
- **Notificaciones:** bandeja, filtros, lectura, preferencias, registro push y agrupación por fecha.
- **UI base:** botones, inputs, pantallas, popover, paginación, barra inferior, imágenes, skeleton, toasts y estados empty/error/offline.
- **Infraestructura:** entorno, errores HTTP, timeout, cancelación, multipart, caché y política de reintentos.
- **Integración:** acceso invitado, catálogo/carrito, carrito conectado, perfil, secciones de perfil y red/query.

Los tests no validan estilos NativeWind ni animaciones nativas. La verificación visual sigue siendo manual.

## Integración continua

`quality.yml` y `tests.yml` se mantienen como workflows independientes. Ambos se
ejecutan en PR hacia `develop`/`main` y push a esas ramas, con `contents: read`,
concurrencia separada por ref y runners `ubuntu-24.04`. Tests también permite
ejecución manual con `workflow_dispatch`. La integración Android no usa credenciales
EAS, Google ni backend real; no publica ni distribuye builds.

`quality.yml` conserva su job `validate` original (15 minutos):

1. checkout;
2. Node 22 con caché npm;
3. `npm ci`;
4. `npm run typecheck`;
5. `npm run lint`;
6. `npm run format:check`;
7. `npm run doctor`.

`tests.yml` conserva el job `tests` (15 minutos por job):

- matriz `unit` e `integration` con `fail-fast: false`;
- Node 22 y `npm ci` por job;
- `npm run test:<suite> -- --ci`;
- resumen con `scripts/test-summary.cjs` incluso si la suite falla;
- artefactos `jest-<suite>-<run_attempt>` con retención de 14 días.

`maestro_checks` ejecuta `npm run test:e2e -- --check` y las pruebas Node de
infraestructura, script CI, selección de cambios, resultado final y preparación de
KVM, sin dispositivo y en paralelo con Jest; timeout de 15 minutos. Estas
verificaciones rápidas no se omiten por cambios documentales.

El job `changes` calcula `android_required` con `scripts/ci/android-policy.cjs`.
En PR compara el árbol del merge probado con el SHA base del evento (diff acumulado
del PR); en push compara `before` con el SHA probado. Usa historial completo,
separadores NUL y `--no-renames`, por lo que borrados y renombrados consideran ambas
rutas. Si falta historia o el diff falla, falla la selección; no se asume que Android
sea opcional. Un primer push sin revisión anterior requiere Android completo.

- Documentación, templates de issues/PR, tests Jest, `tests/support`, herramientas
  de carga/rendimiento y configuración exclusiva de análisis/Jest: solo checks rápidos.
- Runtime `src`, assets, dependencias, Expo/Android, plugins, Maestro, su API ficticia,
  scripts CI y el workflow Tests: cadena Android completa.
- Los fixtures Jest no los importa Maestro; los fixtures E2E están en
  `scripts/maestro-api.cjs`. Cambiar estos últimos sí requiere Android. Una ruta nueva
  o no clasificada, incluidos seeds nuevos, requiere Android por precaución hasta
  confirmar sus consumidores.
- `workflow_dispatch` siempre fuerza Android completo. La etiqueta `ci:android`
  también lo fuerza en un PR, incluso documental; añadirla o retirarla recalcula la
  selección. Para preparar una versión, usar esta solicitud explícita o la ejecución
  manual, además de los cambios de versión/configuración que ya activan Android.

`build_android` requiere `needs: [changes, tests, maestro_checks]` y
`android_required == 'true'`: solo compila si la selección, las dos suites Jest y la
infraestructura Maestro aprueban. Genera Android mediante CNG y compila `assembleDebug`
para `x86_64` con Java 21, SDK/build-tools 36, NDK 27.1.12297006 y CMake 3.30.5/3.22.1.
Las versiones corresponden al React Native instalado con Expo 57.0.31. Se usa
Gradle del proyecto, caché de Gradle de solo lectura en PR y timeout de 60 minutos.
El APK Development Build y su SHA-256 se conservan por 7 días; logs de prebuild,
compilación y reportes Gradle por 14 días, incluso si falla la compilación.

`maestro` requiere `needs: [changes, build_android]` y Android requerido: descarga el APK de la misma ejecución,
comprueba su checksum e instala Maestro 2.11.0 con checksum fijado. Usa un emulador
nuevo Android API 35, AOSP `default`, `x86_64`, perfil Pixel 6 con 2 cores/3072 MB,
pantalla 720×1600 a 320 dpi, KVM y serial
`emulator-5554`; timeout de 30 minutos. `scripts/maestro-ci.sh` comprueba el runner
GitHub-hosted, el serial y la propiedad QEMU antes de instalar o autorizar limpieza.
Antes de instalar Java/Maestro o dependencias, `scripts/ci/prepare-kvm.cjs` registra
existencia, tipo, propietario, modo y acceso a `/dev/kvm`; si existe como dispositivo
de caracteres sin acceso, aplica `sudo -n chmod a+rw /dev/kvm` y verifica nuevamente.
No depende de la aplicación asíncrona de reglas udev. Si falta KVM o no se puede
conceder acceso, falla con diagnóstico persistido en `ci/kvm.json`. El emulador exige
aceleración con `-accel on`; no se transforma un fallo de infraestructura en éxito.
Después ejecuta el runner existente con Metro y la API ficticia local. Un fallo de
instalación, preflight, flujo o limpieza falla el job; no hay reintentos para ocultarlo.
Se recogen logcat, JUnit, capturas, logs y `run.json` cuando cada etapa los produce,
con subida de evidencias incluso tras un fallo y retención de 14 días. Un error
anterior al arranque de Maestro puede no producir JUnit ni `run.json`.

El run 40378701635 superó KVM y la instalación, pero una captura muestra un ANR de
Pixel Launcher encima de Dev Launcher; después ADB quedó offline y los flujos
restantes fallaron al perder el servidor Maestro. `metro.log` también registró un
aborto del DevTools Electron por sandbox SUID. La revisión actual usa AOSP sin
Pixel Launcher/servicios Google, espera ambas colas de Package Manager antes de
instalar y ejecuta Metro con un worker y `EXPO_UNSTABLE_HEADLESS=1` (opción comprobada
en el CLI Expo 57 instalado). No cambia el selector `Connect` ni reintenta tests.
Conserva `lastanr-before.txt` y `lastanr-after.txt`, además de logcat. Los errores
de limpieza se registran en `run.json.cleanupFailures` sin reemplazar el fallo
principal; siguen haciendo fallar el runner. Estos cambios necesitan otro run nativo.

El check final `e2e` usa `if: always()` y
`needs: [changes, tests, maestro_checks, build_android, maestro]`. El cálculo vive
en `scripts/ci/android-policy.cjs` y se prueba automáticamente:

- `changes`, `tests` y `maestro_checks` deben terminar en `success` siempre.
- Si Android es requerido, build y Maestro deben terminar en `success`.
- Si Android no es requerido, ambos deben quedar en `skipped`.
- Una decisión ausente/inválida, un fallo, una cancelación u otra omisión falla el
  check. No se ignoran todos los `skipped` ni se usa `continue-on-error`.

Maestro no se ejecuta tras fallos previos. Quality no forma parte de esta cadena:
`needs` solo relaciona jobs de un mismo workflow y `validate` se exige de forma
independiente. Un `e2e` aprobado con Android opcional solo acredita checks rápidos;
el Summary y los artefactos muestran explícitamente esa decisión.

Las cachés npm siguen ligadas al lockfile y siempre se usa `npm ci`. `changes` y
`e2e` usan solo Node integrado, sin instalar dependencias ni restaurar caché npm.
Gradle conserva su caché con solo lectura en PR; no se reutiliza un APK de otro
commit/run. El SDK aprovecha los componentes preinstalados y `sdkmanager` instala
idempotentemente versiones fijadas solo en el build requerido, incluida CMake
3.22.1 que el build observado descargaba durante Gradle. No se cachean proyectos
nativos generados, snapshots del AVD ni todo el SDK con claves imprecisas.

Para consultar evidencia: GitHub → Actions → Tests → ejecución → Summary y artefactos
`jest-unit-*`, `jest-integration-*`, `android-development-*`, `android-build-*` y
`maestro-android-*`, `android-selection-*` y `e2e-decision-*`. Los diagnósticos
Android/Maestro y decisiones incluyen SHA e intento en el nombre; GitHub los asocia
al run. El APK conserva nombre por SHA dentro del run para reutilizarlo al repetir
solo un job fallido. No se publican comentarios automáticos en el PR.

Para protección de ramas, conservar los checks obligatorios `validate` (Quality),
`unit`, `integration` y `maestro_checks` (Tests), y añadir `e2e` después de confirmar su nombre y
ejecución en GitHub. `e2e` incluye build y Maestro; no sustituye a Quality.

## Maestro local Android

La guía reproducible de Windows 11, diagnóstico, preparación del Development Build,
autorización de limpieza por dispositivo, flujos y evidencias está en
[MAESTRO_E2E.md](./MAESTRO_E2E.md).

```powershell
npm run test:e2e -- --check
node --test scripts/maestro-infra.test.cjs
adb devices -l
npm run maestro -- --version
```

`--check` valida sintaxis YAML, cabeceras y referencias; no ejecuta comandos Maestro
ni certifica el comportamiento nativo. El runner exige `CEMYDI_E2E_DEVICE` explícito,
Development Build verificable y `CEMYDI_E2E_ALLOW_CLEAR` igual al serial autorizado.
Los flujos borran los datos de `com.cemydi.app`: no ejecutarlos directamente con la
CLI sobre una app con datos personales.

Los cinco escenarios usan API ficticia local de lectura; los tres principales
cubren catálogo/búsqueda/disponibilidad, detalle/modalidades y carrito de invitado.
No son pruebas de integración con NestJS ni validan pedidos, rentas o pagos reales.
Cada ejecución que supera preflight guarda JUnit, logs, capturas y resumen en un
subdirectorio de `test-results/maestro/` ignorado por Git. El resultado del runner
falla también por peticiones imprevistas o errores de limpieza, aunque JUnit esté verde.

Sin dispositivo o build compatible se devuelve error antes de abrir la app o iniciar
servidores; no se produce un reporte aprobado. iOS sigue pendiente. El pipeline
Android está configurado; el run 40371511049 compiló el APK pero falló al preparar
KVM antes de arrancar Maestro. La revisión actual requiere otro run en GitHub y
cinco flujos nativos aprobados para confirmar su funcionamiento. Las pruebas locales del script de CI usan comandos
simulados y no acreditan la ejecución del emulador en GitHub.

La ejecución física del 25 de octubre de 2026 en HUAWEI STK-LX3 / Android 10
aprobó los cinco flujos. El reporte, duraciones y limitaciones están al final de
[MAESTRO_E2E.md](./MAESTRO_E2E.md).

## Verificación manual de conectividad

1. Registrar dispositivo, OS, commit/build y red.
2. Abrir Inicio, catálogo, detalle, carrito y notificaciones con red.
3. Activar modo avión y repetir la navegación; verificar mensajes, reintento y ausencia de cierres.
4. Con sesión iniciada, modificar el carrito sin red: la operación debe bloquearse y no debe simular éxito.
5. Recuperar la red y comprobar refetch al reconectar.
6. Verificar que el carrito conserva datos cargados en memoria y que una operación incierta obliga a refrescar antes de repetir.
7. Home usa API pública con contenido editorial local: comprobar la caché y el aviso offline sin confundir las imágenes locales con conectividad al backend.

Jest simula eventos; esta prueba valida OS, permisos y red física.

## Verificación manual de segundo plano

1. Abrir una pantalla con datos remotos y otra con formulario a medio llenar.
2. Enviar la app a segundo plano 30 segundos.
3. Volver y comprobar que la pantalla sigue operativa y que la sesión se revalida al recuperar foco.
4. Repetir con cinco minutos y cambiando la conectividad.
5. Distinguir el retorno al mismo proceso de una terminación por el OS. El carrito de invitado no persiste si el proceso muere; la sesión persistente sí debe restaurarse desde SecureStore.

## Matriz de compatibilidad mínima

| Entorno         | Configuración                        | Comprobaciones                                   | Estado    |
| --------------- | ------------------------------------ | ------------------------------------------------ | --------- |
| Android pequeño | 320–360 dp; OS compatible con SDK 57 | Scroll, columna única, teclado y safe areas      | Pendiente |
| Android mediano | 390–430 dp; OS compatible con SDK 57 | Dos columnas, detalle, carrito y modales         | Pendiente |
| Android físico  | Modelo/OS registrado                 | Red, fluidez, memoria, push y lifecycle          | Pendiente |
| iOS             | Mac/simulador o iPhone               | Navegación, teclado, safe areas, red y lifecycle | Pendiente |
| Tablet          | Android/iOS                          | Layout y orientación; soporte formal pendiente   | Pendiente |

En cada entorno repetir con fuente normal y aumentada, TalkBack/VoiceOver, texto largo, teclado abierto y estados loading/empty/error. Jest no valida NativeWind.

## Rendimiento manual

La Actividad 4 de carga HTTP local está documentada en
[LOAD_TESTING.md](./LOAD_TESTING.md). `npm run test:load` verifica el arnés sin
ejecutar el perfil completo; `npm run load:local` lo ejecuta manualmente contra
una instancia aislada del fixture. Sus evidencias conservan historial en
`test-results/load/` y no requieren dispositivo ni servicios reales.

La metodología reproducible, los escenarios PERF-01 a PERF-05 y la CLI ADB están en
[PERFORMANCE_TESTING.md](./PERFORMANCE_TESTING.md). Ejecutar `npm run test:performance`
para verificar parsers/cálculos sin dispositivo. La medición principal requiere
preview/release sin DEBUGGABLE ni Metro y autorización explícita para los recorridos.
Profiler puede necesitar una build profileable; no reconstruir ni reemplazar APK sin
autorización. Expo Go y Development Build solo sirven para observación exploratoria.

1. Registrar build/commit, modelo, API, red y temperatura.
2. Calentar dos minutos y medir CPU/memoria en reposo y al abrir catálogo.
3. Recorrer catálogo, imágenes, búsqueda, filtros, detalle y carrito diez ciclos.
4. Observar picos, jank, respuesta del teclado y memoria al volver al mismo punto.
5. Comparar contra un baseline del mismo equipo/build y guardar trazas.

No se inventan umbrales de MB, CPU o FPS sin una medición previa.

## UAT y distribución

La UAT es aceptación humana. Debe cubrir, como mínimo:

- registro, verificación y login;
- búsqueda, filtros y detalle;
- agregar al carrito, cambiar cantidades y aplicar cupón;
- configurar fechas/notas de renta;
- consultar una renta y cancelarla cuando corresponda;
- revisar notificaciones y preferencias;
- editar el perfil.

Maestro no equivale a UAT: detecta regresiones mecánicas, no comprensión ni utilidad.

Google Play Internal Testing se usará después de las validaciones automáticas y manuales, con build firmada, identificador y testers. No hay publicación automática.

## Evidencia y límites

Registrar fecha, responsable, dispositivo/OS, commit/build, escenario, pasos, resultado esperado/observado, estado y enlace a evidencia, sin secretos ni datos personales.

Siguen dependiendo de entorno o de funcionalidad:

- ejecución nativa de Maestro;
- push real, Google Sign-In y deep links;
- QA Android/iOS y tablet;
- rendimiento, segundo plano y UAT;
- distribución en Google Play.
