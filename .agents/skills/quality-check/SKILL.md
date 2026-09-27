---
name: quality-check
description: Revisa una tarea de CEMYDI Mobile antes de Review, Testing o Done y reporta fallos con evidencia.
---

# Quality Check

1. Relee criterios de aceptación y revisa el diff completo sin modificar alcance incidentalmente.
2. Confirma que endpoints, DTOs, roles y reglas coinciden con el backend actual.
3. Revisa TypeScript, errores, promises, cleanup, caché, invalidaciones y datos sensibles.
4. Comprueba loading, empty, error, offline, accesibilidad, teclado, safe areas y tamaños móviles.
5. Verifica Android/iOS cuando el cambio afecte UI, navegación o APIs nativas.
6. Ejecuta lint, typecheck, format check y tests disponibles. Distingue fallos nuevos del baseline.
7. Confirma que no cambiaron dependencias, configuración o contratos fuera del alcance.
8. Reporta hallazgos por severidad, comandos ejecutados, decisiones pendientes y riesgo residual.
9. No marques Done si solo compila o quedan errores introducidos por la tarea.
