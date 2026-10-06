---
name: feature-development
description: Implementa features completas de CEMYDI Mobile respetando Expo Router, organización feature-based y límites cliente-servidor.
---

# Feature Development

1. Lee contexto, arquitectura, convenciones y documentos del dominio afectado.
2. Define comportamiento observable, exclusiones, contrato, navegación, estados y pruebas.
3. Inspecciona implementaciones y componentes existentes en `src/components/ui/` y features. Reutiliza componentes base (`AppButton`, `AppInput`, etc.) en vez de primitivas de React Native, y verifica antes de crear nuevos componentes para evitar duplicación.
4. Mantén las rutas delgadas: screen → hook/query → service → API.
5. Delega reglas de negocio, autorización y cálculos definitivos al backend.
6. Incluye loading, empty, error, offline, accesibilidad y lifecycle cuando correspondan.
7. No agregues dependencias ni refactors vecinos sin necesidad demostrada y autorización.
8. Valida lint, typecheck, format y pruebas disponibles; revisa el diff antes de entregar.
9. Actualiza documentación únicamente si cambió una decisión, contrato o límite arquitectónico.
