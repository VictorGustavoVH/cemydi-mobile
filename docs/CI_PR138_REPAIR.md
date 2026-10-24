# Reparación CI del PR #138

Fecha: 24 de octubre de 2026. Base exacta: aacf5f80d0c09e8112e2c5e538178d4823b4aacb, feature/auth-profile.
Destino GitFlow: develop (base b46b2ca). No se modificó historia, ramas ni índices; no hay commits, push ni merge.

## Causas reproducidas

- TypeScript: 22 diagnósticos, principalmente dependencias no versionadas de favoritos/perfil y cuatro rutas de notificaciones. ProductCard no declaraba ratingState. AuthPreviewProvider importaba un servicio eliminado. ApiError ya no acepta data. Tres integraciones importaban cart-api-mock sin versionar.
- Unitarias: 15 suites fallidas, 26 aprobadas; 8 pruebas fallidas y 150 aprobadas. El provider de muestra impedía cargar muchas suites. El mapa de BlurHash importaba PNG de auth eliminados, faltaban dependencias de favoritos, las credenciales de fixtures estaban sin configurar y las expectativas HTTP correspondían a la política anterior.
- Integración: 5 suites fallidas, 1 aprobada; 8 pruebas fallidas y 12 aprobadas. Faltaban cart-api-mock y el proveedor válido; las aserciones de HTTP esperaban data eliminado.
- Al desbloquear las suites aparecieron otros defectos ocultos: AuthLayout pedía un logo WebP no versionado, Home/barra global aún abrían un perfil de muestra y los fixtures Error genéricos ya no podían exponer mensajes de negocio.
- En este worktree Windows, Jest 29 expandía testMatch con separadores mezclados y no descubría pruebas. El baseline se reprodujo con patrones portables por CLI; la propuesta guarda esos patrones en jest.config.js. Los roots y la separación unit/integration se conservan.

## Implementación y alcance

Se incluyen las dependencias transitivas reales de las rutas de cuenta. NotificationsScreen, NotificationRedirectScreen, NotificationPreferencesScreen y NotificationPromotionScreen permanecen en sus rutas ya publicadas. Sus componentes, servicio, schemas, hooks y pruebas son necesarios para conservar el comportamiento, incluidos permisos diferidos desde preferencias. No se monta NotificationLifecycle ni se incorpora HomeNotificationBell.

AppRefreshControl conserva el reenvío de hijos/style necesario para ScrollView Android; AppPagination usa los controles base existentes. Se recuperan usePullToRefresh, useRouteCallback, useProductRatings y product-cache con sus pruebas. ProductCard agrega únicamente ratingState y sus estados; conserva el diseño y la API previos de catálogo. LoadingState admite el spinner compacto requerido por notificaciones. colors.info es el token semántico usado por esos avisos.

AuthProvider reemplaza al proveedor de muestra tanto en producción como en el wrapper de pruebas; cada render de pruebas usa una sesión aislada con almacenamiento simulado. El mock de SecureStore es funcional (lectura/escritura/eliminación), no vacío. Las pruebas válidas se conservan: el carrito de muestra inicia sesión por su servicio real con API simulada; no se cambia a carrito remoto.

cart-api-mock se excluye mediante desacoplamiento: el commit del PR todavía no tiene CartProvider ni servicios de carrito remoto; los tres instaladores eran scaffolding ajeno sin peticiones consumidoras. Se retiran solo imports y llamadas, conservando las aserciones de perfil/acceso/carrito temporal. No hace falta una rama base de carrito para esta reparación.

La política HTTP fue cambiada intencionalmente en efc5752: se conserva la causa, no se adjunta el cuerpo remoto data y solo UserFacingError muestra mensajes de negocio. Se actualizan fixtures y expectativas a esa política, añadiendo cobertura explícita de ausencia de data y ocultación de mensajes remotos. No se reintroduce el contrato retirado.

## Recursos y contratos

Los tres WebP de auth ya existen en Git. El generador ahora los descubre y regenera sus hashes/checksums; AuthLayout reutiliza el PNG de marca ya publicado. Se conservan el logo, catálogo y onboarding del commit, sin incorporar su conversión WebP local. Verificadas 33 referencias estáticas de imágenes y 14 placeholders; ningún archivo faltante.

No cambian package.json, package-lock.json, paquetes nativos, Google Sign-In, app.json/config ni workflows. No cambian endpoints ni DTOs. El servicio de notificaciones se contrastó con NotificationsController, notification.dto.ts y sus respuestas en el backend local: inbox, lectura individual/global, preferencias, promoción, detalle y subscriptions de EXPO; guard CLIENT y autorización permanecen en servidor. ratings y product-cache consumen el productService ya versionado, sin nuevos endpoints.

## Archivos excluidos

Se conservó intacto el checkout original. Se excluyen sus cambios pendientes de:

- carrito remoto: src/providers/cart-provider.tsx, src/features/cart/services/, cupones/resumen servidor, tests/support/cart-api-mock.ts y tests/integration/connected-cart.test.tsx;
- refactors de Home/catálogo/detalle, hooks de reseñas no usados, métricas/rediseño de tarjetas y búsqueda;
- migración a src/app/(tabs), eliminación de rutas existentes, toast-demo y useThrottledCallback;
- conversión WebP de branding/catálogo/onboarding, eliminación de sus PNG/JPG y el script de conversión;
- NotificationLifecycle.tsx, HomeNotificationBell.tsx y su prueba, ajenos a las rutas de perfil que fallaban;
- documentación local de esos módulos, Maestro y cambios de tema/controles no requeridos.

Las únicas ediciones en Home/barra global conectan el acceso a Perfil. La única edición en pruebas de carrito/catálogo adapta autenticación y fixtures de errores; su implementación queda como en el PR.

## Validación reproducible

Se creó pr138-ci-repair desde aacf5f8 sin cambios locales. npm ci terminó con código 0. Se reprodujo el baseline antes de reparar.
Un segundo worktree pr138-ci-verify parte del mismo commit: diff binario más lista explícita de archivos nuevos, sin copiar node_modules, .env, catálogo/carrito local ni archivos ignorados. Allí se instala de nuevo con npm ci y se ejecutan los comandos finales.

Resultados finales en el segundo worktree, Windows, Node 22.23.3 y npm 10.9.9 (las mismas versiones de Node/npm del run fallido de Actions):

| Comando                                               | Resultado final                            |
| ----------------------------------------------------- | ------------------------------------------ |
| npm ci                                                | Código 0; instalación real desde lockfile  |
| npm run typecheck                                     | Código 0                                   |
| npm run lint                                          | Código 0                                   |
| npm run test:unit -- --ci                             | Código 0; 56 suites, 284 pruebas aprobadas |
| npm run test:integration -- --ci                      | Código 0; 6 suites, 45 pruebas aprobadas   |
| npm run format:check                                  | Código 0                                   |
| npm run doctor                                        | Código 0; 21/21 comprobaciones             |
| git diff --check                                      | Código 0                                   |
| python scripts/generate-image-placeholders.py --check | Código 0; 14 placeholders                  |

Evidencia final: C:/Users/Victo/.codex/worktrees/pr138-ci-verify/cemydi-mobile/.tools/verification-results.json, logs con sufijo -verified.log en esa carpeta y JSON/JUnit en test-results/jest/. La copia de los 60 archivos coincide byte por byte con la propuesta; no utiliza archivos del checkout original. El npm ci final conserva los avisos previos de peer dependencies y auditoría (15 vulnerabilidades), sin error de instalación ni cambios de dependencias.

La primera invocación de Doctor dentro de npm exec con --call heredó configuración de npm exec y falló con EUSAGE antes de arrancar Doctor. Se corrigió la invocación usando directamente el runtime Node/npm temporal, sin cambiar scripts ni configuración del proyecto. La repetición de npm run doctor terminó en 21/21.

Exportación Metro/Hermes Android e iOS aprobada con código 0: expo export --platform android --platform ios --output-dir .tools/pr138-export. Se ejecutó sin cargar .env y con URL ficticia de pruebas. Resuelve rutas, módulos y recursos; no equivale a QA nativa.

La propuesta puede verificarse con los workflows existentes de GitHub Actions una vez publicados los commits autorizados. El run remoto actual continúa fallido sobre aacf5f8; no se afirma que exista un nuevo run remoto aprobado. No se probó en un runner Linux.
No se equipara Jest con QA física: Android/iOS, permisos reales, SecureStore y Google Sign-In requieren dispositivos y credenciales. No se efectuó QA nativa ni una ejecución nueva en GitHub Actions.

## Commits propuestos (sin ejecutar)

Cada bloque es una lista exacta de archivos. No se requiere rebase ni alterar los commits existentes; se aplicarían commits aditivos sobre feature/auth-profile y PR hacia develop.

### fix(auth): resolve missing shared dependencies

Restaurar dependencias compartidas de cuenta/favoritos, declarar ratingState, conectar sesión/perfil y cubrir las regresiones sin incorporar carrito remoto.

- `src/app/_layout.tsx` (modificar).
- `src/components/ui/AppPagination.tsx` (añadir).
- `src/components/ui/AppRefreshControl.tsx` (añadir).
- `src/components/ui/GlobalBottomBar.tsx` (modificar).
- `src/components/ui/ProductCard.tsx` (modificar).
- `src/components/ui/__tests__/AppPagination.test.tsx` (añadir).
- `src/components/ui/__tests__/AppRefreshControl.forwarding.test.tsx` (añadir).
- `src/components/ui/__tests__/AppRefreshControl.test.tsx` (añadir).
- `src/components/ui/__tests__/GlobalBottomBar.test.tsx` (modificar).
- `src/components/ui/__tests__/ProductCard.test.tsx` (modificar).
- `src/features/home/HomeScreen.tsx` (modificar).
- `src/hooks/__tests__/useProductRatings.test.tsx` (añadir).
- `src/hooks/__tests__/usePullToRefresh.test.tsx` (añadir).
- `src/hooks/__tests__/useRouteCallback.test.tsx` (añadir).
- `src/hooks/useProductRatings.ts` (añadir).
- `src/hooks/usePullToRefresh.ts` (añadir).
- `src/hooks/useRouteCallback.ts` (añadir).
- `src/providers/auth-preview-provider.tsx` (eliminar).
- `src/services/products/__tests__/product-cache.test.ts` (añadir).
- `src/services/products/product-cache.ts` (añadir).

### test(account): fix Jest fixtures and integration mocks

Configurar fixtures/mocks funcionales y separar pruebas de cuenta de un carrito remoto todavía no publicado; alinear errores con la política de efc5752.

- `jest.config.js` (modificar).
- `jest.env.js` (modificar).
- `jest.setup.ts` (modificar).
- `src/features/cart/__tests__/CartPreviewScreen.test.tsx` (modificar).
- `src/features/catalog/__tests__/CatalogScreen.test.tsx` (modificar).
- `src/services/http/__tests__/api-error.test.ts` (modificar).
- `tests/integration/catalog-cart.test.tsx` (modificar).
- `tests/integration/guest-access.test.tsx` (modificar).
- `tests/integration/http-client.test.ts` (modificar).
- `tests/integration/profile-sections.test.tsx` (modificar).
- `tests/integration/profile.test.tsx` (modificar).
- `tests/support/render-with-toast.tsx` (modificar).

### fix(account): restore required assets and routes

Completar las cuatro rutas ya publicadas con su cierre transitivo y pruebas, reutilizar el logo existente y regenerar placeholders de auth.

- `scripts/generate-image-placeholders.py` (modificar).
- `src/components/ui/LoadingState.tsx` (modificar).
- `src/data/local-image-placeholders.ts` (modificar).
- `src/features/auth/components/AuthLayout.tsx` (modificar).
- `src/features/notifications/NotificationPreferencesScreen.tsx` (añadir).
- `src/features/notifications/NotificationPromotionScreen.tsx` (añadir).
- `src/features/notifications/NotificationRedirectScreen.tsx` (añadir).
- `src/features/notifications/NotificationRow.tsx` (añadir).
- `src/features/notifications/NotificationTabs.tsx` (añadir).
- `src/features/notifications/NotificationsScreen.tsx` (añadir).
- `src/features/notifications/UnreadBadge.tsx` (añadir).
- `src/features/notifications/__tests__/NotificationPreferencesScreen.test.tsx` (añadir).
- `src/features/notifications/__tests__/NotificationRow.test.tsx` (añadir).
- `src/features/notifications/__tests__/NotificationTabs.test.tsx` (añadir).
- `src/features/notifications/__tests__/NotificationsScreen.test.tsx` (añadir).
- `src/features/notifications/__tests__/native-push.test.ts` (añadir).
- `src/features/notifications/__tests__/notification-sections.test.ts` (añadir).
- `src/features/notifications/__tests__/notification-service.test.ts` (añadir).
- `src/features/notifications/__tests__/useNotifications.test.tsx` (añadir).
- `src/features/notifications/native-push.ts` (añadir).
- `src/features/notifications/notification-destination.ts` (añadir).
- `src/features/notifications/notification-presentation.ts` (añadir).
- `src/features/notifications/notification-schemas.ts` (añadir).
- `src/features/notifications/notification-service.ts` (añadir).
- `src/features/notifications/useNotificationPermissionAccess.ts` (añadir).
- `src/features/notifications/useNotifications.ts` (añadir).
- `src/theme/colors.ts` (modificar).
- `docs/CI_PR138_REPAIR.md` (añadir).
