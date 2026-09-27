---
name: api-integration
description: Integra endpoints confirmados de CEMYDI en services, schemas, adapters y TanStack Query del cliente móvil.
---

# API Integration

1. Lee `docs/API_INTEGRATION.md`; para sesión lee también `docs/AUTHENTICATION.md`.
2. Verifica en backend controller, DTO, guard y service el método, ruta, request, rol y response.
3. Detente si el endpoint o campo no existe. No derives contratos nuevos de la UI web.
4. Extiende el cliente HTTP y service del dominio; no crees un transporte paralelo.
5. Valida responses externas con Zod y adapta solo cuando la UI necesite otra forma.
6. Define query keys estables y la actualización o invalidación posterior a mutations.
7. Para multipart usa URIs/FormData nativos y deja el boundary al runtime.
8. No resuelvas cookies versus tokens: la estrategia móvil sigue bloqueada hasta aprobación.
9. Prueba éxito, respuesta inválida, auth, errores y conectividad; ejecuta validaciones disponibles.
