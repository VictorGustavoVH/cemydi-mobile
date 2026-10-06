# CEMYDI Mobile

Cliente móvil de CEMYDI para Android e iOS. El backend existente es la fuente de verdad para contratos, autorización, persistencia y reglas de negocio; el panel administrativo permanece en la aplicación web.

## Stack

- Expo SDK 57 y Expo Router.
- React Native 0.86 y React 19.
- TypeScript estricto.
- NativeWind 4 y Tailwind CSS 3.
- TanStack Query 5.
- React Hook Form y Zod 4.

## Requisitos

- Node.js 22 LTS.
- npm.
- Expo Go o un emulador/dispositivo compatible para desarrollo.

No existen proyectos `ios/` o `android/` versionados. La configuración nativa se mantiene mediante CNG, `app.json` y config plugins.

## Instalación

```bash
npm ci
```

Copia `.env.example` a un archivo local `.env` o `.env.local` y ajusta sus valores para tu entorno.

## Variables de entorno

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.100:4000
EXPO_PUBLIC_APP_ENV=development
```

- `development` puede apuntar a la IP local de la computadora que ejecuta el backend.
- `staging` debe usar su propia URL desplegada.
- `production` debe usar su propia URL HTTPS.
- `localhost` en un dispositivo físico apunta al propio dispositivo, no a la computadora de desarrollo.

> **Regla de seguridad:** `EXPO_PUBLIC_*` se empaqueta en el bundle de la app y es legible para cualquiera. Nunca pongas ahí claves, tokens, contraseñas ni ningún secreto; solo configuración pública.

## Ejecución

```bash
npm run start
npm run android
npm run ios
```

El script web heredado todavía requiere `react-native-web`; el soporte web no forma parte de la foundation móvil actual.

## Comandos de calidad

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run check
npx --yes expo-doctor
```

Hay pre-commit con `lint-staged` (Husky) que ejecuta ESLint y Prettier sobre los archivos modificados, y un workflow de GitHub Actions (`.github/workflows/quality.yml`) que corre typecheck, lint, tests y format check en cada PR.

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
├── features/     # Features por dominio (home, onboarding)
├── hooks/        # Hooks compartidos (p. ej. useNetworkStatus)
├── providers/    # Providers globales pequeños
├── services/     # Infraestructura y acceso HTTP
└── theme/        # Tokens visuales compartidos
```

## Estado actual

- La app funciona con **mocks**: `HomeScreen` consume `useHome` → `homeServiceMock` (`src/features/home/services/homeService.mock.ts`).
- **Pendiente para cuando exista backend:** crear `homeService.api.ts` con la misma interfaz `HomeService`, cambiar el hook `useHome`, integrar autenticación, `expo-secure-store` para tokens y certificate pinning.
- Las pruebas unitarias/componentes ya están configuradas con Jest + React Native Testing Library; ver [TESTING.md](docs/TESTING.md).

Las features se crean de forma incremental fuera de `src/app`. El flujo preferido es `screen → hook/query → service → API`.

## Documentación

- [Contexto del proyecto](docs/PROJECT_CONTEXT.md)
- [Arquitectura](docs/ARCHITECTURE.md)
- [Integración con API](docs/API_INTEGRATION.md)
- [Autenticación](docs/AUTHENTICATION.md)
- [Sistema de diseño](docs/DESIGN_SYSTEM.md)
- [Convenciones](docs/CONVENTIONS.md)
- [Pruebas](docs/TESTING.md)
- [Workflow Git](docs/GIT_WORKFLOW.md)
- [Workflow para IA](docs/AI_WORKFLOW.md)

## Flujo Git

El flujo vigente es `feature/* → develop → main`:

- `main` se reserva para versiones estables y validadas;
- `develop` es la rama de integración;
- `feature/*` se usa para desarrollar cambios aislados a partir de `develop`;
- los cambios regresan a `develop` mediante Pull Request;
- las funcionalidades no se desarrollan directamente sobre `main`.

Antes de abrir un Pull Request ejecuta las verificaciones de calidad del proyecto: `npm run check` y `npx --yes expo-doctor`. Incluye evidencia para cambios visuales, confirma contratos contra el backend y actualiza documentación cuando cambie una decisión, arquitectura o contrato.
