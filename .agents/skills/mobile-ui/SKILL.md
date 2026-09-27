---
name: mobile-ui
description: Diseña o implementa pantallas y componentes de CEMYDI Mobile con NativeWind, accesibilidad y adaptación de referencias visuales a React Native.
---

# Mobile UI

1. Lee `docs/DESIGN_SYSTEM.md` y la ruta o componente análogo.
2. Confirma estados, contenido, navegación y tamaños de pantalla antes de abstraer.
3. Reutiliza tokens y componentes existentes; crea solo lo que tenga un consumidor real.
4. Mantén `#FFFFFF` como fondo principal, `#258e8b` como marca y excluye `#134e4c`.
5. Implementa safe areas, teclado, scroll, loading, empty, error, offline y targets táctiles accesibles.
6. Adapta Figma o web a patrones nativos; no copies DOM, layout desktop ni APIs de Next.js.
7. Verifica Android/iOS, font scaling, textos largos y reduced motion según el alcance.
8. Ejecuta lint, typecheck y format check; reporta el baseline conocido sin ocultarlo.
