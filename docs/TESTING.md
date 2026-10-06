# Estrategia de pruebas

## Estado actual

Jest + React Native Testing Library están configurados con `jest-expo`:

- `jest.config.js` con preset `jest-expo`, alias `@/` y transform de `lucide-react-native`;
- `jest.setup.ts` con mock manual de Reanimated y flag de act environment;
- tests de hooks y componentes en features: `useHome` (`src/features/home/hooks/__tests__/`), `HomeScreen` (`src/features/home/__tests__/`), `ProductDetailScreen` (`src/features/products/__tests__/`) y `CartPreviewScreen` (`src/features/cart/__tests__/`);
- script `npm test` disponible y ejecutado en CI (`.github/workflows/quality.yml`).

Maestro/Detox para E2E sigue pendiente.

## Propuesta de pirámide

### Unit tests

Para:

- adapters y mappers;
- schemas Zod;
- normalización de query params;
- query keys;
- formatters;
- políticas puras de retry o error;
- validaciones de formularios que reflejan DTOs confirmados.

No pruebes reglas duplicadas del backend como si fueran autoridad móvil.

### Service tests

Verifican:

- URL, método, headers y body;
- parsing y validación de respuesta;
- errores 400, 401, 403, 404, 409, 429 y 5xx;
- coordinación de refresh cuando exista estrategia aprobada;
- JSON, multipart y respuestas binarias;
- ausencia de datos sensibles en logs.

### Component tests

Para:

- render y accesibilidad;
- formularios y feedback;
- loading, empty, error, success y offline;
- interacción con buttons, inputs, dialogs y lists;
- estados de sesión simulados;
- comportamiento visible, no clases internas salvo que sean contrato visual.

### Integration tests

Para flujos de feature con providers reales y red simulada:

- registro y verificación;
- login, sesión y logout después de elegir transporte;
- búsqueda y filtros;
- carrito y cupones;
- configuración y creación de renta;
- carga y reemplazo de receta;
- perfil y rentas propias.

### E2E

Herramienta pendiente. Evaluar Maestro o Detox después de definir builds de desarrollo y CI.

Flujos prioritarios:

1. registro → verificación → login;
2. catálogo → detalle → carrito;
3. item de renta → fechas → receta → solicitud;
4. perfil → actualización;
5. rentas → detalle → cancelación permitida;
6. expiración/refresh/logout.

Checkout, pedidos y pagos no deben incluirse porque no existen en el backend actual.

## Matriz mínima por feature

Cada feature debe considerar:

- camino exitoso;
- validación de entrada;
- error de servidor;
- no autorizado y prohibido;
- loading;
- empty state;
- retry seguro;
- pérdida y recuperación de red;
- background/foreground;
- textos largos y accesibilidad;
- Android/iOS y tamaños de pantalla relevantes.

## Casos críticos

### Auth

- credenciales inválidas sin enumerar cuentas;
- correo no verificado;
- sesión expirada;
- refresh concurrente y fallido;
- revocación y logout;
- limpieza de caché al cambiar usuario;
- almacenamiento seguro según estrategia aprobada.

### Cart

- modos venta/renta;
- cantidad límite;
- producto sin stock o inactivo;
- fechas incompletas;
- promoción/cupón devueltos por backend;
- respuesta incompatible;
- prevención de doble submit.

### Rentals

- campos condicionales de paciente y domicilio;
- aceptación legal obligatoria;
- receta requerida, inválida o mayor a 8 MB;
- estados y cancelación permitida;
- documento no autorizado;
- upload interrumpido.

## Conectividad y lifecycle

Probar:

- inicio sin red;
- pérdida de red durante query y mutación;
- retorno de red;
- app en background durante upload o refresh;
- datos stale al volver a foreground;
- requests cancelados y cleanup de listeners.

No reintentes automáticamente mutaciones no idempotentes sin confirmar si el servidor las procesó.

## Rendimiento y memoria

- listas largas virtualizadas;
- imágenes remotas y caché;
- renders de items;
- memoria después de navegar repetidamente;
- cleanup de previews, listeners y uploads;
- tiempo de interacción en dispositivos Android modestos.

## Compatibilidad

Validar al menos:

- Android e iOS;
- teléfono pequeño, mediano y grande;
- font scaling;
- teclado abierto;
- safe areas y notch;
- tema light actual;
- tablet solo si se confirma soporte formal.

## Herramientas pendientes

Pendiente de evaluación e integración:

- Mock Service Worker o mocks de `fetch` compatibles para pruebas de integración de red;
- Maestro o Detox para E2E (evaluar tras definir builds de desarrollo y CI).

## Comandos objetivo

Los comandos actuales obligatorios son:

```bash
npm run lint
npm run typecheck
npm run format:check
npm test
```

Para paquetes Expo nativos usa `npx expo install`.
