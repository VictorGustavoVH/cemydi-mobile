# Integración con la API de CEMYDI

## Fuente de verdad

Este documento incluye únicamente rutas confirmadas en controllers del backend auditado. No convierte tipos del frontend web en contratos normativos.

No inventes endpoints, campos, filtros, roles o respuestas. Cuando cambie el backend, actualiza schemas, adapters, tests y este documento en la misma tarea.

## URL base

El backend no define un prefijo global `/api`. Su default local es:

```text
http://localhost:4000
```

La web usa `/api` porque Next.js lo reescribe al backend. El móvil no debe asumir que `/api` forma parte de la ruta real.

### Configuración objetivo

La foundation usa `EXPO_PUBLIC_API_URL` únicamente para la URL no secreta del backend y centraliza su acceso en `src/config/env.ts`. `.env.example` documenta valores seguros de ejemplo.

- Un dispositivo físico no puede usar `localhost` para alcanzar la computadora de desarrollo.
- Producción debe usar HTTPS.
- No incluyas claves privadas en variables `EXPO_PUBLIC_*`.
- Las URLs definitivas de development, staging y production están pendientes.

## Acceso, headers y transporte actual

- Las lecturas públicas de productos, promociones y reseñas no requieren credenciales.
- Perfil, carrito, rentas propias, documentos privados y reseñas propias requieren autenticación.
- El backend acepta el access JWT desde la cookie `cemydi_access` o desde `Authorization: Bearer <token>`.
- Login no devuelve ese JWT en el body y refresh obtiene `cemydi_refresh` exclusivamente de cookie; por ello Bearer no es todavía un flujo móvil completo.
- JSON usa `Content-Type: application/json` y `Accept: application/json` cuando corresponda.
- Uploads de receta usan multipart con el campo `file`; el runtime debe generar el boundary.
- Cuando CSRF está activo, las mutaciones no excluidas requieren la cookie `cemydi_csrf` y el header `x-csrf-token` coincidente.
- El backend habilita CORS con origins configurados y `credentials: true`; la lista real de producción no fue leída ni verificada.

La decisión entre cookies y tokens para móvil sigue pendiente. Consulta `AUTHENTICATION.md` antes de implementar un cliente autenticado.

## Contratos confirmados

### Verificación inicial de conectividad

| Método | Ruta | Acceso  | Respuesta confirmada |
| ------ | ---- | ------- | -------------------- |
| GET    | `/`  | Público | `Hello World!`       |

Este endpoint está definido en `AppController` y su respuesta en `AppService`. La app lo usa exclusivamente como una verificación manual, segura y sin efectos secundarios de la conexión inicial; no representa un contrato de salud operativa ni agrega lógica de negocio al cliente.

Para comprobar TK-08 desde la app:

1. configura `EXPO_PUBLIC_API_URL` con una URL alcanzable del backend y ejecuta `npm run start`;
2. abre `/diagnostico` y pulsa **Probar conexión** (en Expo Go, usa `exp://HOST:PUERTO/--/diagnostico`);
3. confirma que aparece el estado exitoso y la respuesta validada `Hello World!`;
4. detén el backend o configura temporalmente una URL/puerto sin servicio, reinicia Expo y repite la acción para comprobar el estado de error;
5. restaura la URL correcta antes de continuar el desarrollo.

La verificación usa `httpClient`, lee la base desde `env.apiUrl`, valida la respuesta con Zod y no registra ni almacena secretos. No se agregó un framework de pruebas porque el proyecto todavía no tiene uno configurado.

### Autenticación y recuperación

| Método | Ruta                                    | Body confirmado                   | Comportamiento                                        |
| ------ | --------------------------------------- | --------------------------------- | ----------------------------------------------------- |
| POST   | `/auth/register`                        | `nombre`, `correo`, `password`    | Registro y envío de verificación; respuesta genérica  |
| POST   | `/auth/login`                           | `correo`, `password`              | Emite cookies y devuelve `{ user }`                   |
| GET    | `/auth/google`                          | —                                 | Inicia OAuth web mediante redirect                    |
| GET    | `/auth/google/callback`                 | query `code`, `state`, `error`    | Callback web y redirect al frontend                   |
| POST   | `/auth/refresh`                         | —                                 | Lee refresh cookie, rota sesión y devuelve `{ user }` |
| GET    | `/auth/csrf`                            | —                                 | Emite cookie CSRF y devuelve mensaje                  |
| POST   | `/auth/logout`                          | —                                 | Revoca sesión cuando puede y limpia cookies           |
| POST   | `/auth/email-verification/send`         | `correo`                          | Reenvía verificación con respuesta no enumerativa     |
| POST   | `/auth/email-verification/confirm`      | `token`                           | Confirma por token                                    |
| POST   | `/auth/email-verification/confirm-code` | `correo`, `codigo`                | Confirma por código                                   |
| POST   | `/auth/password-reset/request`          | `correo`                          | Solicita recuperación                                 |
| POST   | `/auth/password-reset/verify-code`      | `correo`, `codigo`                | Verifica código                                       |
| POST   | `/auth/password-reset/verify-token`     | `token`                           | Verifica token                                        |
| POST   | `/auth/password-reset/confirm`          | `correo`, `codigo`, `newPassword` | Cambia contraseña por código                          |
| POST   | `/auth/password-reset/confirm-token`    | `token`, `newPassword`            | Cambia contraseña por token                           |

`GET /auth/google` y su callback son flujos diseñados para navegador. No constituyen todavía un contrato Google Sign-In nativo.

### Perfil

| Método | Ruta        | Contrato confirmado                                                                              |
| ------ | ----------- | ------------------------------------------------------------------------------------------------ |
| GET    | `/users/me` | `{ user: AuthUserProfile \| null }` sin credenciales; credenciales inválidas pueden producir 401 |
| PATCH  | `/users/me` | Campos opcionales: `nombre`, `correo`, `telefono`, `direccion`, `password`                       |

Roles confirmados: `ADMIN` y `CLIENT`.

### Productos y catálogo

| Método | Ruta                            | Acceso                 |
| ------ | ------------------------------- | ---------------------- |
| GET    | `/products`                     | Público; auth opcional |
| GET    | `/products/slug/:slug`          | Público; auth opcional |
| GET    | `/products/:id`                 | Público; auth opcional |
| GET    | `/products/:id/recommendations` | Público; auth opcional |

Query params confirmados para `GET /products`:

- `search`: texto, máximo 120 caracteres;
- `clasificaciones`: lista o texto separado por comas, máximo 20;
- `marcas`: lista o texto separado por comas, máximo 20;
- `tipos`: máximo 3 valores; el servicio reconoce `VENTA`, `RENTA`, `MIXTO`;
- `requiereReceta`: `true` o `false`;
- `soloDisponibles`: booleano textual;
- `sort`: texto, máximo 20;
- `page`: entero desde 1;
- `pageSize`: entero de 1 a 200;
- `includeInactive`: existe, pero el service exige `ADMIN` cuando es verdadero.

Respuesta confirmada de listado:

```ts
{
  products: Product[];
  filters: { clasificaciones: string[]; marcas: string[] };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPrevious: boolean;
    hasNext: boolean;
  };
}
```

El detalle responde `{ product }`. Las recomendaciones limitan `limit` al rango 1–12 y usan 5 por default.

### Promociones

| Método | Ruta          | Acceso                            |
| ------ | ------------- | --------------------------------- |
| GET    | `/promotions` | Público; devuelve ofertas activas |

`includeExpired=true` está reservado por el service para `ADMIN`. Los descuentos finales deben provenir del backend.

### Carrito

Todos los endpoints usan `JwtAuthGuard`.

| Método | Ruta                  | Body                                                               |
| ------ | --------------------- | ------------------------------------------------------------------ |
| GET    | `/cart`               | —                                                                  |
| POST   | `/cart/items`         | `productId`, `quantity`, `mode?`, fechas/notas de renta opcionales |
| PATCH  | `/cart/items/:itemId` | `quantity`, fechas/notas de renta opcionales                       |
| DELETE | `/cart/items/:itemId` | —                                                                  |
| POST   | `/cart/coupon`        | `{ code }`                                                         |
| DELETE | `/cart/coupon`        | —                                                                  |
| DELETE | `/cart/rentals`       | —                                                                  |
| DELETE | `/cart`               | —                                                                  |

`mode` admite `VENTA` o `RENTA`. `quantity` admite 1–25. El backend devuelve el carrito completo después de las mutaciones y calcula disponibilidad, promoción, cupón, subtotales, depósitos y total.

El controller de carrito exige autenticación, pero no tiene un guard explícito de rol `CLIENT`. No añadas una restricción móvil fingiendo que ya es autorización del servidor.

### Rentas

Las operaciones del cliente exigen sesión y rol `CLIENT`.

| Método | Ruta                  | Descripción                                               |
| ------ | --------------------- | --------------------------------------------------------- |
| GET    | `/rentals/mine`       | Lista paginada, búsqueda, conteos y filtros de estado     |
| GET    | `/rentals/mine/:id`   | Detalle propio                                            |
| POST   | `/rentals/from-cart`  | Crea una solicitud desde items de renta válidos           |
| PATCH  | `/rentals/:id/cancel` | Cancela una solicitud propia cuando el backend lo permite |

Filtros confirmados de `mine`: `status`, `search`, `page`, `pageSize`. `pageSize` máximo: 30.

El DTO de creación confirma datos del solicitante, paciente opcional, método de entrega, domicilio condicional, referencias, horario, notas y aceptaciones legales obligatorias.

### Documentos de renta

| Método | Ruta                                       | Transporte                            |
| ------ | ------------------------------------------ | ------------------------------------- |
| POST   | `/rentals/cart-items/:itemId/prescription` | multipart, campo `file`               |
| DELETE | `/rentals/cart-items/:itemId/prescription` | —                                     |
| POST   | `/rentals/items/:itemId/prescription`      | multipart, campo `file`               |
| GET    | `/rentals/documents/:documentId/content`   | binario; query `disposition` opcional |
| GET    | `/rentals/items/:itemId/prescription`      | binario legacy/por item               |

Formatos confirmados: PDF, JPG/JPEG y PNG. Tamaño máximo: 8 MB. El servidor valida extensión, MIME y contenido real.

### Reseñas

| Método | Ruta                               | Acceso                                                  |
| ------ | ---------------------------------- | ------------------------------------------------------- |
| GET    | `/reviews/product/:productId`      | Público                                                 |
| GET    | `/reviews/testimonials`            | Público                                                 |
| GET    | `/reviews/mine`                    | Autenticado                                             |
| GET    | `/reviews/product/:productId/mine` | Autenticado                                             |
| POST   | `/reviews`                         | Autenticado; `productId`, `rating` 1–5, `comment` 5–500 |

## Funcionalidades ausentes

> **NOT IMPLEMENTED IN CURRENT BACKEND:** checkout de venta.

> **NOT IMPLEMENTED IN CURRENT BACKEND:** creación y consulta de pedidos de venta.

> **NOT IMPLEMENTED IN CURRENT BACKEND:** procesamiento, autorización o captura de pagos.

> **NOT IMPLEMENTED IN CURRENT BACKEND:** historial de pedidos de venta consumible por móvil.

No diseñes rutas provisionales para estas funciones. Requieren contrato y reglas de backend antes de implementar UI conectada.

## Cliente HTTP objetivo

Debe existir una sola infraestructura compartida que:

1. resuelva la URL base;
2. serialice JSON o multipart sin fijar manualmente el boundary;
3. normalice errores del backend;
4. valide respuestas relevantes con Zod;
5. coordine un solo refresh en vuelo, si la estrategia aprobada lo permite;
6. no registre credenciales ni bodies sensibles.

No elijas todavía el transporte de sesión. Consulta `AUTHENTICATION.md`.

## Errores

El backend normalmente responde:

```ts
type ApiErrorBody = {
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp: string;
  path: string;
};
```

El cliente debe conservar `statusCode` y body para decisiones técnicas, pero presentar mensajes seguros en español. Maneja explícitamente 400, 401, 403, 404, 409, 429 y 5xx.

## DTOs, schemas y adapters

- Un request DTO móvil debe reflejar solo campos confirmados.
- Un schema Zod valida el límite externo.
- Un adapter es apropiado para fechas, valores opcionales o formas convenientes para UI.
- No agregues defaults que oculten una respuesta incompatible.
- Nunca reutilices directamente DTOs administrativos para flujos de cliente.

## TanStack Query

Propuesta de familias de query keys:

```ts
['session']['profile'][('products', 'list', normalizedFilters)][
  ('products', 'detail', productIdOrSlug)
][('products', 'recommendations', productId)][('promotions', 'active')]['cart'][
  ('rentals', 'mine', normalizedFilters)
][('rentals', 'detail', rentalId)][('reviews', 'product', productId)];
```

Después de mutar carrito, cupón, receta o renta, actualiza la caché con la respuesta del servidor o invalida las keys relacionadas. No inventes optimistic updates para operaciones con reglas complejas sin una estrategia de rollback.

## Uploads y binarios

- React Native usa URIs y objetos multipart nativos, no `File` del DOM.
- No fijes `Content-Type: multipart/form-data` con boundary manual.
- Valida tamaño y tipo para UX, pero conserva la validación del backend como autoridad.
- La política de descarga, preview y compartir documentos sigue pendiente.
