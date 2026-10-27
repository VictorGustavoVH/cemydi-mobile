# CEMYDI Mobile

Cliente móvil de CEMYDI para Android e iOS. El backend existente es la fuente de verdad para contratos, autorización, persistencia y reglas de negocio; el panel administrativo permanece en la aplicación web.

## Stack

- Expo SDK 57 y Expo Router con typed routes.
- React Native 0.86 y React 19.
- TypeScript estricto.
- NativeWind 4 y Tailwind CSS 3.
- TanStack Query 5.
- React Hook Form y Zod 4.

Las versiones exactas están en `package.json` y `package-lock.json`.

## Requisitos

- Node.js 22 LTS.
- npm.
- Un emulador o dispositivo Android/iOS compatible con Expo SDK 57.
- Para compilaciones nativas: Android Studio/JDK o macOS con Xcode según la plataforma.

No existen proyectos `ios/` o `android/` versionados. La configuración nativa se mantiene mediante CNG, `app.json`, `app.config.js` y config plugins.

Google Sign-In y las notificaciones push requieren una build nativa; no están disponibles en Expo Go.

## Instalación

```bash
npm ci
```

Copia `.env.example` a un archivo local `.env` o `.env.local` y ajusta sus valores para tu entorno.

## Variables de entorno

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.100:4000
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_WEBSITE_URL=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=""
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_EAS_PROJECT_ID=
GOOGLE_SERVICES_JSON=
```

- `EXPO_PUBLIC_API_URL` es obligatoria. Debe ser una URL absoluta y usar HTTPS en `production`.
- `EXPO_PUBLIC_APP_ENV` es obligatoria: `development`, `staging` o `production`.
- `EXPO_PUBLIC_WEBSITE_URL` es opcional y se usa para enlaces legales.
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` y `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` configuran Google Sign-In nativo. Sin ellas, el botón informa que Google no está configurado.
- `EXPO_PUBLIC_EAS_PROJECT_ID` habilita el registro de push de Expo.
- `GOOGLE_SERVICES_JSON` apunta al archivo de Firebase para Android. Se usa en prebuild; no es una variable `EXPO_PUBLIC_*`.

Notas de red:

- `development` puede apuntar a la IP local de la computadora que ejecuta el backend.
- `staging` y `production` deben usar sus propias URLs desplegadas.
- `localhost` en un dispositivo físico apunta al propio dispositivo, no a la computadora de desarrollo.
- En el emulador Android, `http://10.0.2.2:4000` alcanza el backend de la computadora. En un teléfono físico, usa la IP LAN actual y conecta ambos a la misma red.
- Si cambia la IP, actualiza `EXPO_PUBLIC_API_URL` y reinicia Metro con `npm run start -- --clear`.

> **Regla de seguridad:** `EXPO_PUBLIC_*` se empaqueta en el bundle de la app y es legible para cualquiera. Nunca pongas ahí claves, tokens, contraseñas ni ningún secreto; solo configuración pública.

## Ejecución

```bash
npm run start          # Metro para Expo Go
npm run android        # expo run:android
npm run ios            # expo run:ios (requiere macOS)
npm run start:local    # Metro en localhost con prioridad IPv4, para ADB reverse
```

El script `npm run web` es heredado y todavía requiere `react-native-web`; el soporte web no forma parte del cliente móvil actual.

Para probar Expo Go en Android mediante ADB reverse, usa `npm run start:local` y consulta [TESTING.md](./docs/TESTING.md) para los recorridos Maestro y puertos alternativos.

## Comandos de calidad

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run check           # typecheck + lint + format:check + tests
npx --yes expo-doctor
```

Hay pre-commit con `lint-staged` (Husky) que ejecuta ESLint y Prettier sobre los
archivos modificados. Los workflows `.github/workflows/quality.yml` y `tests.yml`
se ejecutan de forma independiente en PR y push a `develop` o `main`. Quality
conserva typecheck, lint, formato y Expo Doctor. Tests conserva ambas suites Jest y,
mediante `needs`, añade el build Android y los cinco flujos Maestro cuando hay
cambios relevantes. Los PR documentales conservan las validaciones rápidas y omiten
el APK. La ejecución manual o la etiqueta `ci:android` fuerzan Android completo.
El check final `e2e` distingue esa omisión legítima de un fallo. Ver
[TESTING.md](docs/TESTING.md) para evidencias y checks obligatorios. La corrección
de KVM requiere una nueva ejecución nativa en GitHub para validar los cinco flujos.

## Estructura resumida

```text
assets/
├── branding/     # Logotipos y emblema de CEMYDI
├── icons/        # Icono de aplicación y favicon activos
├── images/       # Imágenes agrupadas por experiencia
└── legacy/       # Recursos anteriores conservados, no activos

src/
├── app/          # Rutas y layouts de Expo Router
├── components/   # UI compartida (incluye ErrorBoundary y estados comunes)
├── config/       # Configuración validada de entorno
├── data/         # Fixtures y datos de presentación locales
├── features/     # auth, cart, catalog, favorites, home, notifications,
│                 # onboarding, products y profile
├── hooks/        # Hooks compartidos (red, búsqueda, refresco, etc.)
├── providers/    # Query, Auth, Cart, CatalogPreview y Toast
├── services/     # Cliente HTTP y contratos de productos
└── theme/        # Tokens visuales compartidos
```

El flujo preferido es `screen → hook/query → service → API`. Las features se crean de forma incremental fuera de `src/app`; no se crean carpetas o abstracciones vacías.

## Estado actual

- **Catálogo conectado:** Inicio muestra seis productos y promociones reales; `/catalogo` pagina de 24 en 24 con búsqueda, filtros, orden y búsqueda por voz; `/producto/[id]` consume detalle, reseñas y recomendaciones.
- **Autenticación conectada:** registro con OTP, login, recuperación de contraseña, Google Sign-In nativo, restauración de sesión, refresh rotatorio y logout. El access token vive en memoria y el refresh en `expo-secure-store` cuando se elige mantener la sesión.
- **Carrito conectado:** una cuenta autenticada usa `/cart`; un invitado conserva un carrito local en memoria. Incluye cupones, cantidades, fechas y notas de renta. No incluye checkout, pagos ni envío de solicitudes de renta.
- **Cuenta del cliente:** perfil editable, rentas propias con detalle y cancelación, reseñas, documentos legales y cambio de correo/contraseña con OTP.
- **Favoritos y notificaciones:** favoritos contra el backend; bandeja de notificaciones, filtros, lectura, preferencias y registro de push.
- **Estados de UI:** loading, empty, error, reintento y pérdida de conectividad en las pantallas con datos remotos. No hay persistencia offline de datos.
- **Pendientes funcionales:** checkout y pedidos de venta, pagos, creación de solicitudes de renta desde el carrito, carga de recetas desde móvil, soporte formal de tablet, app/universal links para tokens de correo y validación nativa de push.

Consulta [PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) para el alcance completo y [API_INTEGRATION.md](docs/API_INTEGRATION.md) para los contratos implementados.

## Documentación

- [Contexto del proyecto](docs/PROJECT_CONTEXT.md)
- [Arquitectura](docs/ARCHITECTURE.md)
- [Integración con API](docs/API_INTEGRATION.md)
- [Autenticación](docs/AUTHENTICATION.md)
- [Catálogo](docs/CATALOG.md)
- [Carrito](docs/CART.md)
- [Perfil y cuenta](docs/PROFILE.md)
- [Notificaciones](docs/NOTIFICATIONS.md)
- [Sistema de diseño](docs/DESIGN_SYSTEM.md)
- [Calidad móvil](docs/MOBILE_QUALITY.md)
- [Convenciones](docs/CONVENTIONS.md)
- [Pruebas](docs/TESTING.md)
- [EAS Android](docs/EAS_ANDROID.md)
- [Workflow Git](docs/GIT_WORKFLOW.md)
- [Workflow para IA](docs/AI_WORKFLOW.md)
- [Historial de documentos archivados](docs/archive/)

Los documentos en `docs/archive/` son históricos y no describen necesariamente el comportamiento actual.

## Flujo Git

El flujo vigente es `feature/* → develop → main`:

- `main` se reserva para versiones estables y validadas;
- `develop` es la rama de integración;
- `feature/*` se usa para desarrollar cambios aislados a partir de `develop`;
- los cambios regresan a `develop` mediante Pull Request;
- las funcionalidades no se desarrollan directamente sobre `main`.

Antes de abrir un Pull Request ejecuta `npm run check` y `npx --yes expo-doctor`. Incluye evidencia para cambios visuales, confirma contratos contra el backend y actualiza documentación cuando cambie una decisión, arquitectura o contrato.


[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/VictorGustavoVH/cemydi-mobile)
