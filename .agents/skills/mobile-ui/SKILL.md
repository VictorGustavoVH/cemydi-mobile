---
name: mobile-ui
description: Diseña o implementa pantallas y componentes de CEMYDI Mobile con NativeWind, accesibilidad y adaptación de referencias visuales a React Native.
---

# Mobile UI

1. Lee `docs/DESIGN_SYSTEM.md` y la ruta o componente análogo.
2. Confirma estados, contenido, navegación y tamaños de pantalla antes de abstraer.
3. Verificación obligatoria de componentes: inspecciona siempre `src/components/ui/` y las features antes de escribir UI. Reutiliza componentes existentes (`AppButton`, `AppInput`, `AppScreen`, `LoadingState`, etc.) en lugar de implementar primitivas crudas de React Native (`Pressable`, `TextInput`, `ActivityIndicator`).
4. Si un componente ya existe, revisa su contrato, props y variantes para consumirlo correctamente o extenderlo si es necesario.
5. Si creas un componente nuevo, verifica que no exista un equivalente, ubícalo según alcance (`src/components/ui` solo si es transversal; si no, en la feature), define props tipadas explícitas, estados (loading, pressed, disabled) y accesibilidad.
6. Mantén `#FFFFFF` como fondo principal, `#258e8b` como marca y excluye `#134e4c`.
7. Implementa safe areas, teclado, scroll, loading, empty, error, offline y targets táctiles accesibles.
8. Adapta Figma o web a patrones nativos; no copies DOM, layout desktop ni APIs de Next.js.
9. Verifica Android/iOS, font scaling, textos largos y reduced motion según el alcance.
10. Ejecuta lint, typecheck y format check; reporta el baseline conocido sin ocultarlo.
