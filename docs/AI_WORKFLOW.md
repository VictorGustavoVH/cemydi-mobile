# Flujo de trabajo para IA

## Workflow obligatorio

### 1. Leer instrucciones

Lee `AGENTS.md` y conserva cambios no relacionados del usuario. Revisa el documento especializado según la tarea.

### 2. Seleccionar skill

Busca una skill aplicable en `.agents/skills` y lee su `SKILL.md` completo. Usa solo las skills necesarias.

### 3. Estudiar código existente

Localiza rutas, componentes, hooks, services, schemas, tipos, providers y pruebas relacionados. Inspecciona `src/components/ui/` y features para verificar componentes existentes antes de proponer o crear nuevos. No asumas que la estructura objetivo ya existe.

### 4. Verificar el backend

Antes de implementar una integración:

- revisa controller, DTO, guard y service;
- confirma método, ruta, campos, roles y respuesta;
- revisa errores y uploads;
- no uses el frontend web como autoridad cuando contradiga al backend.

No inventes endpoints, DTO fields, roles o permisos.

### 5. Definir el cambio mínimo

Explicita comportamiento, archivos, estados de UI, caché, accesibilidad, plataformas y pruebas. Detente si falta una decisión de producto o contrato que cambie materialmente la solución.

### 6. Implementar

- mantiene rutas delgadas;
- reutiliza componentes existentes (`src/components/ui/`) en vez de crear duplicados o usar primitivas crudas de React Native;
- si crea un componente nuevo, verifica previamente que no exista, define props explícitas tipadas, estados y accesibilidad;
- usa services y schemas del dominio;
- no duplica reglas del backend;
- no crea carpetas o abstracciones vacías;
- no agrega dependencias si el stack actual basta;
- para paquetes Expo nativos usa `npx expo install`;
- no expone secretos.

La autenticación móvil usa tokens explícitos aprobados según AUTHENTICATION.md. No cambies el transporte sin aprobación.

### 7. Validar

Ejecuta al menos:

```bash
npm run lint
npm run typecheck
npm run format:check
```

Agrega tests cuando exista el framework. Para UI o APIs nativas, valida Android/iOS proporcionalmente al riesgo.

`npm run format:check` debe pasar sin incidencias.

### 8. Revisar

Comprueba:

- diff limitado al alcance;
- contratos confirmados;
- loading, empty, error y offline;
- accesibilidad y responsive;
- caché e invalidación;
- cleanup de listeners y requests;
- ausencia de secretos y logs sensibles;
- documentación actualizada si cambió arquitectura, contrato o decisión.

### 9. Entregar

Resume archivos, resultado observable, validaciones, fallos preexistentes, decisiones pendientes y cualquier verificación necesaria del backend.

No declares Done únicamente porque compile.
