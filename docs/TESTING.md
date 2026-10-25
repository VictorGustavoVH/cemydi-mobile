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
  tests.yml                # matrices unit e integration
.maestro/
  config.yaml
  catalog.yaml
  product-detail.yaml
  cart.yaml
  onboarding.yaml
  tabs.yaml
  support/open-app.yaml
  support/open-catalog.yaml
  support/open-preview-product.yaml
scripts/
  android.cjs
  maestro.cjs
  maestro-e2e.cjs
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

`quality.yml` (`validate`):

1. checkout;
2. Node 22 con caché npm;
3. `npm ci`;
4. `npm run typecheck`;
5. `npm run lint`;
6. `npm run format:check`;
7. `npm run doctor`.

`tests.yml`:

- matriz `unit` e `integration` con `fail-fast: false`;
- Node 22 y `npm ci` por job;
- `npm run test:<suite> -- --ci`;
- resumen con `scripts/test-summary.cjs` incluso si la suite falla;
- artefactos `jest-<suite>-<run_attempt>` con retención de 14 días.

Ambos workflows se ejecutan en PR y push a `develop` y `main`, usan `ubuntu-24.04`, `contents: read`, timeout de 15 minutos y concurrencia por ref.

Para consultar evidencia: GitHub → Actions → ejecución → Summary y artefactos `jest-unit-*` / `jest-integration-*`. No se publican comentarios automáticos en el PR.

Para la protección de ramas se recomienda exigir los checks `validate`, `unit` e `integration` con los nombres exactos que GitHub muestre tras el primer run.

## Maestro local Android

Los cinco flujos de `.maestro/config.yaml` cubren catálogo/búsqueda/filtros,
detalle de muestra/modalidades/favoritos, carrito invitado/cantidad/deshacer,
onboarding y conservación de búsqueda al alternar pestañas. No envían rentas,
no procesan pagos y no usan credenciales reales.

El destino es el development build cuyo identificador y scheme provienen de
`app.json`. No se ejecutan estos flujos sobre Expo Go. Se necesitan Java 17+,
Maestro CLI y un emulador Android autorizado con la build instalada. La CLI no
se versiona: instalar su distribución oficial en `.tools/maestro/maestro` o
configurar `CEMYDI_MAESTRO_HOME` apuntando al directorio que contenga `lib/`.
Consultar [instalación de Maestro](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli).

```bash
adb devices
npm run maestro -- --version
npm run test:e2e
```

El runner selecciona un emulador conectado o el dispositivo indicado por
`CEMYDI_E2E_DEVICE`. Comprueba la app instalada y que el puerto Metro 8091 esté
libre; inicia su propio Metro y una API pública ficticia de solo lectura en 4198.
Configura ADB reverse sin reemplazar redirecciones ajenas y limpia sus procesos,
servidor y redirecciones al terminar. `EXPO_NO_DOTENV=1` evita usar una API privada
por accidente. No hay que arrancar manualmente otro Metro para estos flujos.

Los subflujos reciben `APP_ID`, `APP_SCHEME` y `DEV_CLIENT_URL` del runner.
`open-app.yaml` limpia el estado de esa app de pruebas para empezar como invitado:
usar un emulador dedicado, sin datos personales. La introducción del development
client se cierra únicamente si aparece. Los selectores usan labels existentes.
El flujo de detalle/carrito abre el fixture explícito `/producto/wheelchair`.

Al llegar a Maestro se solicita un reporte JUnit en
`test-results/maestro/results.xml`. Los argumentos adicionales se pasan al CLI,
por ejemplo para cambiar el destino del reporte:

```bash
npm run test:e2e -- --output test-results/maestro/otra-ejecucion.xml
```

Sin dispositivo o build instalada el runner devuelve un error explícito antes
de arrancar servidores. No genera un reporte aprobado ni desactiva pruebas.
La validación de YAML y Jest no certifica scroll, temporización, diálogos del
sistema ni navegación nativa. iOS requiere macOS y una preparación propia.
E2E en CI queda pendiente de una build instalable y un emulador estable; no se
agrega un pipeline que aparente haber ejecutado pruebas sin esos requisitos.

Referencia: [reportes de Maestro](https://docs.maestro.dev/maestro-flows/workspace-management/test-reports-and-artifacts).
Estado de esta entrega: [MOBILE_QUALITY.md](./MOBILE_QUALITY.md).

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

Para evidencia propia, preparar una build Android debuggable/profileable mediante CNG. Expo Go sirve para observaciones exploratorias, pero mezcla el costo del contenedor de desarrollo.

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
