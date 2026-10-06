# Convenciones de desarrollo

## Principios

- TypeScript estricto; evita `any`.
- Cambios pequeños y limitados al feature solicitado.
- Reutiliza antes de crear una abstracción.
- El backend define contratos, permisos y reglas de negocio.
- No agregues una dependencia cuando el stack actual resuelva el problema.
- No crees carpetas vacías ni capas por anticipación.

## Naming

- Componentes y pantallas: `PascalCase`.
- Hooks: `useSomething`.
- Funciones y variables: `camelCase`.
- Constantes globales reales: `UPPER_SNAKE_CASE`.
- Tipos: nombres de dominio en `PascalCase`; evita prefijos `I`.
- Rutas de Expo Router: convención de archivo requerida por Router, preferentemente kebab-case para segmentos públicos.
- Skills: lowercase con guiones.

## Organización

`src/app` contiene únicamente rutas, layouts y composición inmediata de navegación. Componentes, hooks, schemas, services y utilidades viven fuera.

Coloca código específico dentro de su feature. Promuévelo a `components`, `services`, `hooks`, `types` o `utils` compartidos solo cuando tenga consumidores de más de una feature.

## Imports y aliases

- Usa `@/` para imports desde `src`.
- Usa imports relativos para archivos muy cercanos dentro de un mismo módulo cuando mejoren legibilidad.
- Evita barrel files globales y ciclos entre features.
- No importes internals de otra feature; expón una superficie pequeña o mueve el contrato compartido.

## Routes y screens

- Una ruta coordina navegación y render de una screen/feature.
- No hagas fetch directo desde archivos de ruta.
- Usa Expo Router para toda navegación.
- Mantén código no-ruta fuera de `src/app`.
- Los route guards son UX; la autorización permanece en el backend.

## Componentes

- **Verificación previa obligatoria**: Antes de codificar UI o crear un nuevo componente, inspecciona siempre los componentes existentes en `src/components/ui` y en features relevantes.
- Reutiliza componentes base (`AppButton`, `AppInput`, `AppScreen`, `LoadingState`, etc.) en lugar de implementar primitivas crudas de React Native (`Pressable`, `TextInput`, `ActivityIndicator`).
- Si un componente ya existe, verifica su contrato y props para reutilizarlo o extenderlo limpiamente.
- Si creas un nuevo componente, verifica que no exista uno equivalente para no duplicar código; define props tipadas explícitas, estados (loading, pressed, disabled, error) y accesibilidad.
- Ubicación: componentes reutilizables transversales en `src/components/ui/`; componentes propios de un flujo en `src/features/<feature>/components/`.
- Presentación separada de acceso a datos cuando mejore testabilidad.
- No anides cards o wrappers sin una responsabilidad clara.
- Extrae un componente cuando reduzca duplicación o complejidad real, no por número de líneas.

## Hooks

- Hooks de query/mutation viven en la feature correspondiente.
- Hooks transversales en `src/hooks` solo con reutilización real.
- Un hook no debe ocultar efectos inesperados o reglas del backend.
- Limpia listeners y suscripciones.

## Services

- Una operación de red pertenece al service de su dominio.
- Usa el cliente HTTP compartido; no crees clientes paralelos.
- Acepta DTOs claros y devuelve datos validados/adaptados.
- No navega, muestra alerts ni depende de componentes.
- No inventa endpoint o fallback contractual.

## DTOs, schemas, types y adapters

- **DTO:** forma confirmada del request.
- **Schema Zod:** validación runtime de datos externos.
- **Type:** modelo estático derivado del schema cuando sea posible.
- **Adapter:** conversión explícita entre contrato externo y modelo de UI.

No declares campos opcionales solo para hacer pasar una respuesta incompatible. Compara primero con el backend.

## TanStack Query

- Query keys serializables, estables y organizadas por dominio.
- Normaliza filtros antes de usarlos en una key.
- Configura `staleTime`, retry y refetch según volatilidad y riesgo.
- No reintentes automáticamente errores 4xx de validación o autorización.
- Después de mutar, actualiza con la respuesta del servidor o invalida las keys afectadas.
- No guardes estado de formulario ni secretos en la caché.

## React Hook Form y Zod

- Usa Zod para formularios ligados a DTOs o con validación cruzada.
- Mantén mensajes en español y enfoca el primer error cuando sea viable.
- La validación local mejora UX; conserva y presenta errores del backend.
- No dupliques reglas complejas de negocio.

## Errores

- Normaliza el body de error de la API en una clase o discriminated union compartida.
- Conserva status y causa técnica sin exponer datos sensibles.
- Distingue validación, autenticación, autorización, red, timeout y servidor.
- Ofrece retry solo para operaciones idempotentes o cuando la acción sea segura.
- Nunca ocultes un error contractual con datos mock en producción.

## TypeScript

- Evita casts; valida datos externos.
- Usa unions para roles y estados confirmados.
- Agota unions relevantes con `never` cuando ayude a detectar cambios.
- No uses enums locales para aparentar un contrato que el backend no define.

## NativeWind

- Fondo principal móvil: `#FFFFFF`.
- Marca: `#258e8b`.
- No uses `#134e4c`.
- Prefiere tokens semánticos a hexadecimales repetidos.
- No generes clases dinámicas no detectables.
- Mantén clases ordenadas mediante Prettier.

## Secrets y configuración

- `EXPO_PUBLIC_*` forma parte del bundle y no es secreto.
- Nunca copies valores de `.env` reales a código, docs, tests o logs.
- No incluyas API keys privadas en el móvil.
- La URL pública de API sí puede configurarse como variable pública.
- Credenciales persistentes, si se aprueban, usan almacenamiento seguro.

## Dependencias y Expo

- Revisa la versión mayor de Expo antes de usar APIs Expo.
- Para paquetes nativos usa `npx expo install`.
- No edites `ios/` o `android/` manualmente mientras se use CNG.
- No ejecutes `npm audit fix --force`.
- No instales Axios, otra navegación o un store global sin necesidad demostrada.

## Formato

Prettier es la autoridad de formato. El baseline de `format:check` está normalizado y pasa correctamente.
