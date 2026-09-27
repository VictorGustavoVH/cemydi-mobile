# CEMYDI Mobile — instrucciones para agentes

## Project

Cliente móvil Expo/React Native de CEMYDI para clientes. El backend existente es la fuente de verdad; el panel administrativo permanece en la web.

## Stack

Expo 57, Expo Router, React Native 0.86, React 19, TypeScript estricto, NativeWind 4/Tailwind 3, TanStack Query 5, React Hook Form y Zod 4. Usa npm.

## Mandatory reading

- Contexto o alcance: `docs/PROJECT_CONTEXT.md`.
- Estructura o capas: `docs/ARCHITECTURE.md`.
- Endpoints o datos: `docs/API_INTEGRATION.md`.
- Sesión o rutas protegidas: `docs/AUTHENTICATION.md`.
- UI: `docs/DESIGN_SYSTEM.md`.
- Código nuevo: `docs/CONVENTIONS.md`.
- Ramas, PRs o releases: `docs/GIT_WORKFLOW.md`.
- Pruebas: `docs/TESTING.md`.
- Proceso completo: `docs/AI_WORKFLOW.md`.

Antes de implementar, busca una skill aplicable en `.agents/skills/` y lee su `SKILL.md` completo.

## Architecture

- `src/app` contiene solo rutas y layouts de Expo Router.
- Código no-ruta vive fuera de `src/app` y se organiza por feature cuando exista.
- Flujo preferido: screen → hook/query → service → API.
- No crees carpetas o abstracciones vacías.

## Core rules

- No invent endpoints.
- No invent DTO fields.
- No invent roles or permissions.
- Do not duplicate backend business logic.
- Validate backend contracts before implementing API integrations.
- Do not add dependencies when the existing stack solves the problem.
- For Expo native packages use `npx expo install`.
- Do not use `npm audit fix --force`.
- Keep non-route code outside `src/app`.
- No copies secretos ni valores reales de `.env`.
- La autenticación móvil está bloqueada: no elijas cookies o tokens sin aprobación.
- No uses `#134e4c`; fondo principal `#FFFFFF`, marca `#258e8b`.

## Expo

Verifica primero la versión instalada y documentación correspondiente. Mientras no existan `ios/` y `android/`, usa CNG y configura comportamiento nativo mediante `app.json`/config plugins; no edites proyectos nativos manualmente.

## Validation

```bash
npm run lint
npm run typecheck
npm run format:check
```

`npm run format:check` pasa correctamente. Ejecuta tests cuando el proyecto tenga framework configurado.

## Done

Una tarea está Done cuando cumple aceptación, contratos confirmados, validación aplicable, estados loading/empty/error/offline, accesibilidad, Android/iOS según riesgo y documentación actualizada. Compilar por sí solo no basta.
