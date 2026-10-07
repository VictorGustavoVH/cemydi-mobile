# Entrega técnica: recursos de pruebas y pipelines

Fecha: 6 de octubre de 2026. Alcance: contenido del repositorio CEMYDI Mobile, sin acceso a GitHub Projects/Issues, backend de producción ni publicación.

## Estado inicial y recursos existentes

- Working tree inicialmente limpio.
- Expo 57.0.26, React Native 0.86.3 y React 19.2.3 instalados; Node local 24.11.0 y CI existente Node 22.
- Jest 29.7.0, jest-expo 57.0.5, React Native Testing Library 14.0.1, @types/jest 29.5.14 y react-test-renderer 19.2.3 ya instalados. Se conservaron.
- ESLint 9.39.5/config Expo/config Prettier, TypeScript 6.0.3 y Prettier 3.9.9/plugin Tailwind ya instalados y configurados.
- Expo Network 57.0.2 instalado y usado por QueryProvider para onlineManager; useNetworkStatus existía sin consumidores de pantalla.
- TanStack Query, React Hook Form, resolvers y Zod ya instalados. No había formularios funcionales React Hook Form/Zod que justificaran inventar pruebas nuevas.
- jest.config.js, jest.setup.ts, configuración Babel para Jest, alias e imports Lucide ya funcionaban.
- Cuatro suites con 12 pruebas pasaban; TypeScript y ESLint pasaban.
- Prettier detectó 70 archivos con finales de línea incompatibles: core.autocrlf=true convertía a CRLF y el formato esperado era LF. Se normalizó con Prettier y se añadió .gitattributes.
- quality.yml incluía todas las verificaciones y tests en un job; no filtraba branches en pull_request.
- No había selección de suites, directorio de integración, Maestro ni flujo E2E CI. No hay proyectos ios/android, configuración EAS, identificadores nativos ni APK.
- ADB y Java ya disponibles; adb devices no detectó emulador/dispositivo conectado.

## Instalaciones

No se añadieron, eliminaron ni actualizaron dependencias npm; package-lock.json permanece sin cambios. npm ci reinstaló el grafo existente.

Se descargó la distribución oficial de Maestro 2.11.0 en `.tools/maestro/maestro` (ignorada por Git), para ejecutar flows nativos localmente con Java. Expo Doctor se obtuvo mediante el comando npx solicitado, sin convertirlo en dependencia de la app. Node 22.23.3 se utilizó como runtime temporal de verificación CI mediante npx; no modifica la versión del proyecto o del sistema.

Durante npm ci Windows bloqueó una librería nativa existente. Se trasladó node_modules a `.tools/node_modules-pre-ci` dentro del mismo proyecto y se completó una instalación nueva, sin detener procesos ajenos. Puede permanecer parte del respaldo ignorado mientras Windows mantenga el archivo abierto.

## Archivos creados

```text
.gitattributes
.github/workflows/tests.yml
.maestro/config.yaml
.maestro/catalog.yaml
.maestro/product-detail.yaml
.maestro/cart.yaml
.maestro/support/open-catalog.yaml
jest.env.js
scripts/maestro.cjs
src/components/ui/__tests__/controls.test.tsx
src/config/__tests__/env.test.ts
src/data/__tests__/product-detail-preview.test.ts
src/features/cart/__tests__/cart-preview.test.ts
src/features/home/hooks/__tests__/useHome.failures.test.tsx
src/hooks/__tests__/useNetworkStatus.test.tsx
src/services/http/__tests__/api-error.test.ts
tests/integration/catalog-cart.test.tsx
tests/integration/http-client.test.ts
tests/integration/query-network.test.tsx
tests/support/network-mock.ts
docs/TESTING_SETUP_REPORT.md
```

## Archivos modificados

Cambios de contenido:

```text
.github/workflows/quality.yml
.gitignore
.prettierignore
docs/TESTING.md
eslint.config.js
jest.config.js
jest.setup.ts
package.json
src/hooks/useNetworkStatus.ts
src/providers/query-provider.tsx
tsconfig.json
```

Además se normalizaron finales de línea en los 70 archivos señalados inicialmente por Prettier (incluyen documentos, rutas, componentes, configuración y pruebas existentes). No se cambió su lógica ni diseño; Git puede mostrarlos como modificados por finales de línea aun cuando el diff de contenido sea vacío. Se mantuvieron todas las pruebas originales. No se cambiaron contratos, endpoints, autenticación ni dependencias.

Las únicas correcciones funcionales son de lifecycle de conectividad: useNetworkStatus conserva un evento nuevo si la consulta inicial llega tarde; QueryProvider ignora respuestas/eventos después del cleanup. Ambas tienen pruebas de regresión.

## Pruebas conservadas y nuevas

Existentes: useHome (2), HomeScreen (1), ProductDetailScreen (4) y CartPreviewScreen (5), total 12.

Nuevas: siete suites unitarias/de componentes y tres integraciones, 74 casos adicionales. Resultado final: **14 suites, 86 pruebas**.

- Unitarias/componentes: 11 suites, 63 pruebas. Fechas y resúmenes locales, entorno, productos/recomendaciones, clasificación/retry HTTP, botones/inputs/feedback/accesibilidad, errores/concurrencia de Home y estado/eventos/cleanup de Expo Network.
- Integración: 3 suites, 23 pruebas. Catálogo/filtros/loading/error/retry con servicio real de muestra, navegación simulada y estado compartido entre pantallas; cliente HTTP con fetch controlado; QueryProvider/caché/pausa-reconexión/retry/cleanup con Expo Network simulado.
- Maestro: tres flows de vistas de muestra Android, sin login ni envío de renta, con textos/accessibilityLabels existentes y sin testID nuevos.

Todas las pruebas Jest usan entorno ficticio y fetch explícitamente simulado; ninguna contacta un backend real. No se instala MSW, no se duplican pruebas de regresión ni se construyen tests de funcionalidades ausentes.

## Scripts npm finales

| Script           | Comando                                                               |
| ---------------- | --------------------------------------------------------------------- |
| start            | expo start                                                            |
| android          | expo start --android                                                  |
| ios              | expo start --ios                                                      |
| web              | expo start --web                                                      |
| lint             | eslint .                                                              |
| lint:fix         | eslint . --fix                                                        |
| format           | prettier --write .                                                    |
| format:check     | prettier --check .                                                    |
| typecheck        | tsc --noEmit                                                          |
| test             | jest                                                                  |
| test:unit        | jest --selectProjects unit                                            |
| test:integration | jest --selectProjects integration                                     |
| test:all         | jest --ci                                                             |
| maestro          | node scripts/maestro.cjs                                              |
| test:e2e         | node scripts/maestro.cjs test .maestro                                |
| doctor           | npx --yes expo-doctor                                                 |
| prepare          | husky                                                                 |
| check            | npm run typecheck && npm run lint && npm run format:check && npm test |

## Workflows finales

quality.yml hace checkout, Node 22/cache npm, npm ci, typecheck, lint, format:check y Expo Doctor. tests.yml usa matriz unit/integration con checkout, Node 22/cache, npm ci y el script específico --ci. Componentes se ejecutan en unit.

Ambos corren en PR hacia develop/main y push a develop/main, con contents: read, timeout de 15 minutos y cancelación de runs obsoletos. No contienen continue-on-error ni ignoran exit codes. La reejecución de las mismas suites constituye regresión automatizada. El contenido YAML se valida localmente; la ejecución en servidores GitHub y los checks requeridos dependen de subir/revisar los cambios y de administración del repositorio.

La estructura completa, comandos E2E y protocolos manuales están en [TESTING.md](TESTING.md).

## Validación ejecutada

| Comando                                                              | Resultado                                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| npm ci                                                               | Correcto, instalación desde lockfile existente                                  |
| npm run typecheck                                                    | Correcto                                                                        |
| npm run lint                                                         | Correcto                                                                        |
| npm run format:check                                                 | Correcto                                                                        |
| npm test                                                             | Correcto: 14 suites, 86 pruebas, también con Node 22                            |
| npm test -- --ci                                                     | Correcto: 14 suites, 86 pruebas                                                 |
| npm run test:unit                                                    | Correcto: 11 suites, 63 pruebas                                                 |
| npm run test:integration                                             | Correcto: 3 suites, 23 pruebas                                                  |
| npm run test:all                                                     | Correcto: 14 suites, 86 pruebas                                                 |
| npm run check bajo Node 22.23.3                                      | Correcto: TypeScript, ESLint, Prettier y todas las suites                       |
| npx --yes expo-doctor                                                | 21/21 comprobaciones satisfactorias                                             |
| npm run maestro -- --version                                         | Correcto: 2.11.0                                                                |
| npm run test:e2e -- --format JUNIT --output test-results/maestro.xml | No ejecutable: cero dispositivos conectados; no se atribuyen resultados a flows |

npm ci emite avisos del grafo conservado: peer react-reconciler/test-renderer frente a React 19.2.3, paquetes deprecated y reporte de npm audit con 75 vulnerabilidades (20 moderate, 55 high). No se aplicó audit fix ni se actualizó React/Expo masivamente; Doctor y tests pasan. Requiere tratamiento de dependencias por separado, con revisión del impacto. Una ejecución fría paralela con Node 24 emitió un aviso act de VirtualizedList; la validación completa con Node 22 terminó sin ese aviso y no se silenció console.error.

## Automatizadas, manuales y pendientes

Automatizadas en CI: análisis estático, Doctor, unitarias, componentes, integración y regresión. Maestro queda preparado para ejecución local con dispositivo y Metro; no hay workflow Android sin APK/build establecido.

Manuales, por depender del OS, hardware o aceptación humana: conectividad física, background, matriz de compatibilidad, CPU/memoria/fluidez con Android Studio Profiler, esfuerzo/sesiones prolongadas y UAT. TESTING.md define pasos y evidencia requerida, sin inventar resultados o umbrales.

Pendientes: ejecutar los flows y QA en Android disponible; iOS cuando haya entorno real; builds/identificadores aprobados para E2E CI y Profiler propio; autenticación y funciones de negocio cuando se implementen; aceptación UAT humana y distribución Google Play Internal Testing después de validaciones y aprobación. No se publica ni despliega nada.

El repositorio cuenta con recursos y pipelines para cumplir técnicamente las actividades 2 y 3 en el alcance ejecutable actual. Esto no equivale a declarar aprobadas las pruebas móviles, UAT o distribución que aún requieren ejecución externa.
