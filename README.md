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
- Todo valor `EXPO_PUBLIC_*` forma parte del bundle y no puede contener secretos.

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
npm run check
npx --yes expo-doctor
```

## Estructura resumida

```text
src/
├── app/          # Rutas y layouts de Expo Router
├── components/   # UI compartida
├── config/       # Configuración validada de entorno
├── providers/    # Providers globales pequeños
├── services/     # Infraestructura y acceso HTTP
└── theme/        # Tokens visuales compartidos
```

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

La estrategia documentada es `feature/* → develop → main`. El repositorio todavía requiere una decisión explícita para crear y adoptar la rama `develop`; consulta `docs/GIT_WORKFLOW.md` antes de abrir una rama o PR.

Antes de un PR ejecuta `npm run check` y `npx --yes expo-doctor`. Incluye evidencia para cambios visuales, confirma contratos contra el backend y actualiza documentación cuando cambie una decisión, arquitectura o contrato.
