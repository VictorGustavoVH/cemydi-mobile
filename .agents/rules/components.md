# Regla: Verificación y Reutilización de Componentes

## 1. Verificación previa obligatoria
Antes de crear cualquier componente nuevo o escribir elementos interactivos o de UI en una pantalla:
- Inspecciona siempre `src/components/ui/` y los componentes existentes en `src/features/`.
- Revisa qué componentes base ya existen (`AppButton`, `AppInput`, `AppScreen`, `LoadingState`, etc.) y cuáles son sus variantes y props soportadas.

## 2. Reutilización sobre duplicación
- Prohibido implementar primitivas crudas de React Native (`Pressable`, `TouchableOpacity`, `TextInput`, `ActivityIndicator`) cuando exista un componente base equivalente (`AppButton`, `AppInput`, `LoadingState`).
- Si un componente existente necesita una pequeña extensión o variante (ej. variantes de color, iconos, estados adicionales permitidos por el sistema de diseño), extiende el componente existente en lugar de crear un clon o meter código inline duplicado.

## 3. Creación de nuevos componentes
Si se determina que se requiere un componente nuevo:
- **Verificar inexistencia**: Asegurarse de que no exista ya en otra parte del codebase.
- **Ubicación adecuada**:
  - `src/components/ui/` únicamente si es un componente base o transversal a toda la aplicación.
  - `src/features/<feature>/components/` si está acoplado al dominio de esa feature.
- **Contrato y TypeScript**: Props explícitas y tipadas, sin tipos `any`.
- **Estados completos**: Implementar estados `default`, `pressed` (para interactivos), `disabled`, `loading` y `error` cuando aplique.
- **Accesibilidad**: Incluir `accessibilityRole`, `accessibilityLabel`, `accessibilityState` y asegurar un target táctil mínimo de 44x44 pt.
- **Diseño**: Usar tokens de Tailwind/NativeWind, fondo principal `#FFFFFF`, color de marca `#258e8b`, prohibido `#134e4c`.
- **Validación**: Ejecutar `npm run lint`, `npm run typecheck` y `npm run format:check`.
