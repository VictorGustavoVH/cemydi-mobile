# Integración con la API de CEMYDI

## Fuente de verdad

Este documento incluye únicamente rutas confirmadas en controllers del backend y consumidas por el cliente móvil. No convierte tipos del frontend web en contratos normativos.

No inventes endpoints, campos, filtros, roles o respuestas. Cuando cambie el backend, actualiza schemas, adapters, tests y este documento en la misma tarea.

## URL base

El backend no define un prefijo global `/api`. Su default local es `http://localhost:4000`.

La web usa `/api` porque Next.js lo reescribe al backend. El móvil no debe asumir que `/api` forma parte de la ruta real.

La URL se configura con `EXPO_PUBLIC_API_URL` y se valida en `src/config/env.ts`:

- debe ser una URL absoluta `http` o `https`;
- `production` exige HTTPS;
- un dispositivo físico no puede usar `localhost` para alcanzar la computadora de desarrollo;
- en el emulador Android, `10.0.2.2` alcanza el host;
- nunca se colocan claves privadas en variables `EXPO_PUBLIC_*`.

## Transporte y headers

- El cliente HTTP compartido vive en `src/services/http`.
- Las lecturas públicas usan `credentials: 'omit'` y no envían autorización.
- Los recursos privados usan `authenticated: true`, que envía `Authorization: Bearer <access token>` con `credentials: 'omit'`.
- El móvil no usa cookies ni CSRF. El backend exime las peticiones Bearer sin cookies de access/refresh; los guards JWT y de rol siguen aplicando.
- JSON usa `Content-Type: application/json` y `Accept: application/json`.
- Timeout por defecto: 15 segundos.
- Ante 401, `httpClient` coordina un único refresh y repite la operación como máximo una vez. Un segundo 401 expira la sesión.
- Los errores HTTP se normalizan en `ApiError`; la UI muestra mensajes seguros en español.
- Ninguna petición registra credenciales, tokens ni bodies sensibles.

- Perfil, carrito, rentas propias, documentos privados y reseñas propias requieren autenticación.
- Móvil usa login/refresh/logout explícitos de `/auth/mobile/*`; el access token vive en memoria y el refresh en SecureStore según [AUTHENTICATION.md](./AUTHENTICATION.md).
- Las rutas web de autenticación conservan cookies HTTP-only y CSRF; no se usan para simular una sesión nativa.

## Autenticación y recuperación

| Método | Ruta                                    | Body                              | Uso móvil                                     |
| ------ | --------------------------------------- | --------------------------------- | --------------------------------------------- |
| POST   | `/auth/register`                        | `nombre`, `correo`, `password`    | Registro; no crea sesión                      |
| POST   | `/auth/mobile/login`                    | `correo`, `password`              | Login con tokens móviles                      |
| POST   | `/auth/mobile/google`                   | `idToken`                         | Google Sign-In nativo                         |
| POST   | `/auth/mobile/refresh`                  | `refreshToken`                    | Restauración y rotación de sesión             |
| POST   | `/auth/mobile/logout`                   | `refreshToken`                    | Revocación de la sesión                       |
| POST   | `/auth/email-verification/send`         | `correo`                          | Reenvío de verificación                       |
| POST   | `/auth/email-verification/confirm-code` | `correo`, `codigo`                | Verificación de correo                        |
| POST   | `/auth/password-reset/request`          | `correo`                          | Solicitud de recuperación                     |
| POST   | `/auth/password-reset/verify-code`      | `correo`, `codigo`                | Verificación del código; devuelve `expiresAt` |
| POST   | `/auth/password-reset/confirm`          | `correo`, `codigo`, `newPassword` | Cambio de contraseña                          |
| GET    | `/users/me`                             | —                                 | Revalidación de sesión con Bearer             |

Los endpoints `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/google` y `/auth/google/callback` son flujos web basados en cookies y no se usan en móvil.

Sesión móvil:

```ts
{
  user: {
    id: number;
    nombre: string;
    correo: string;
    activo: boolean;
    rol: 'ADMIN' | 'CLIENT';
    emailVerified: boolean;
    emailVerifiedAt: string | null;
  }
  accessToken: string;
  refreshToken: string; // 64 caracteres hexadecimales
  accessExpiresInMs: number;
  refreshExpiresInMs: number;
}
```

Los endpoints móviles no emiten cookies y llevan `Cache-Control: no-store`. El refresh rota en cada uso y solo su hash se guarda en el backend.

## Perfil y seguridad

| Método | Ruta                                | Body                                 |
| ------ | ----------------------------------- | ------------------------------------ |
| GET    | `/users/me`                         | —                                    |
| PATCH  | `/users/me`                         | `nombre?`, `telefono?`, `direccion?` |
| POST   | `/users/me/email-change/request`    | `newEmail`, `currentPassword`        |
| POST   | `/users/me/email-change/resend`     | `{}`                                 |
| POST   | `/users/me/email-change/confirm`    | `newEmail`, `codigo`                 |
| POST   | `/users/me/password-change/request` | `currentPassword`                    |
| POST   | `/users/me/password-change/resend`  | `{}`                                 |
| POST   | `/users/me/password-change/confirm` | `codigo`, `newPassword`              |

`GET /users/me` responde `{ user }` o `{ user: null }`. `PATCH /users/me` responde `{ message, user }`.

Las solicitudes de cambio de correo o contraseña responden `{ message, resendAt, expiresAt }`. Las confirmaciones responden `{ message }` y revocan las sesiones del backend; el móvil limpia su sesión y vuelve a login.

Roles confirmados: `ADMIN` y `CLIENT`. Las features de cliente validan el rol `CLIENT` antes de habilitar recursos privados.

## Productos y catálogo

Integración móvil vigente: [CATALOG.md](./CATALOG.md). Home, catálogo y detalle consumen lecturas públicas mediante schemas/adapters de `src/services/products`, sin credenciales. Promociones se consultan separadamente; carrito y sesión se documentan en [CART.md](./CART.md) y [AUTHENTICATION.md](./AUTHENTICATION.md).

| Método | Ruta                            | Acceso                 |
| ------ | ------------------------------- | ---------------------- |
| GET    | `/products`                     | Público; auth opcional |
| GET    | `/products/:id`                 | Público; auth opcional |
| GET    | `/products/:id/recommendations` | Público; auth opcional |
| GET    | `/promotions`                   | Público                |
| GET    | `/reviews/product/:productId`   | Público                |

Query params usados por el móvil en `GET /products`:

- `search`: texto, máximo 120 caracteres;
- `clasificaciones`: lista separada por comas;
- `marcas`: lista separada por comas;
- `tipos`: `VENTA`, `RENTA` o `MIXTO`, separados por comas;
- `requiereReceta`: `true` o `false`;
- `soloDisponibles`: `true`;
- `sort`: `reciente`, `precio-asc`, `precio-desc`, `disponibles`, `popular`, `nombre-asc` o `nombre-desc`;
- `page`: entero desde 1;
- `pageSize`: el móvil usa 24 en catálogo.

Respuesta de listado:

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

El detalle responde `{ product }`. Las recomendaciones usan `limit=5`. Los precios, la disponibilidad y los descuentos finales provienen del backend; el móvil no los recalcula.

`soloDisponibles`, filtros y orden se combinan en `normalizeProductFilters`. Los errores de parseo se muestran como respuesta inválida, nunca como datos parciales.

## Promociones y reseñas

- `GET /promotions` devuelve las ofertas activas.
- `GET /reviews/product/:productId` devuelve la calificación y las reseñas públicas.
- `GET /reviews/mine` devuelve las reseñas del cliente autenticado.

`POST /reviews` existe en el backend, pero el móvil todavía no lo consume.

## Carrito

Todos los endpoints exigen autenticación. El móvil no usa el carrito del backend para invitados: mantiene un carrito local en memoria.

| Método | Ruta                  | Body                                                              |
| ------ | --------------------- | ----------------------------------------------------------------- |
| GET    | `/cart`               | —                                                                 |
| POST   | `/cart/items`         | `productId`, `quantity`, `mode`, fechas/notas de renta opcionales |
| PATCH  | `/cart/items/:itemId` | `quantity`, fechas/notas de renta opcionales                      |
| DELETE | `/cart/items/:itemId` | —                                                                 |
| POST   | `/cart/coupon`        | `{ code }`                                                        |
| DELETE | `/cart/coupon`        | —                                                                 |
| DELETE | `/cart/rentals`       | —                                                                 |
| DELETE | `/cart`               | —                                                                 |

Campos confirmados del request:

- `mode`: `VENTA` o `RENTA`;
- `quantity`: entero de 1 a 25;
- `productId`: entero positivo;
- `rentalStartDate` y `rentalEndDate`: fechas ISO `YYYY-MM-DD` opcionales;
- `rentalNotes`: texto de hasta 500 caracteres;
- `code`: 4 a 24 letras, números, guiones o guion bajo.

Todas las operaciones responden `{ cart }` con el carrito completo. El backend calcula disponibilidad, promoción, cupón, subtotales, depósitos y total.

Estados de línea confirmados: `configurationStatus` (`PENDING` o `COMPLETE`), `availability`, `promotion`, `rentalSummary` y `document`. Una línea de renta puede requerir fechas antes de considerarse completa.

Mensajes de negocio reconocidos: stock insuficiente, producto no encontrado, cupón inexistente/vencido/agotado, compra mínima, renta mínima y límite de unidades. Cualquier otro mensaje se reemplaza por uno seguro.

## Rentas

Las operaciones del cliente exigen sesión y rol `CLIENT`.

| Método | Ruta                  | Uso móvil                                                    |
| ------ | --------------------- | ------------------------------------------------------------ |
| GET    | `/rentals/mine`       | Lista paginada; el móvil usa `pageSize=8`                    |
| GET    | `/rentals/mine/:id`   | Detalle propio                                               |
| PATCH  | `/rentals/:id/cancel` | Cancela una solicitud pendiente cuando el backend lo permite |

Estados confirmados de renta: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `DELIVERED` y `RETURNED`.

Estados de depósito: `PENDING`, `RETURNED`, `RETAINED` y `PARTIALLY_RETAINED`.

El detalle incluye folio, fechas, importes, método de entrega, domicilio, notas, estado de depósito e items con su receta asociada.

**No implementado en móvil:** `POST /rentals/from-cart`, la carga/eliminación de recetas y la descarga de documentos. El backend ya expone esos contratos; el cliente no los consume todavía.

## Documentos legales

| Método | Ruta                     | Acceso  |
| ------ | ------------------------ | ------- |
| GET    | `/legal-documents/:slug` | Público |

Slugs confirmados:

- `politicas-de-privacidad`
- `terminos-y-condiciones`

La respuesta contiene `document.slug`, `title`, `description` y `sections[]` con `id`, `title`, `body` y `variant` opcional. El móvil convierte el HTML en texto plano y nunca ejecuta scripts ni carga recursos remotos.

## Favoritos

| Método | Ruta                           | Respuesta                    |
| ------ | ------------------------------ | ---------------------------- |
| GET    | `/favorites`                   | Lista de productos favoritos |
| GET    | `/favorites/ids`               | Identificadores favoritos    |
| POST   | `/favorites/toggle/:productId` | Estado resultante            |
| POST   | `/favorites/:productId`        | Agrega el producto           |
| DELETE | `/favorites/:productId`        | Elimina el producto          |

Todas requieren autenticación. `productId` es numérico.

Respuestas confirmadas:

- `GET /favorites`: `{ products, favoriteIds, total }`.
- `GET /favorites/ids`: `{ favoriteIds }`.
- Toggle, alta y baja: `{ message, favorited, productId }`.

## Notificaciones

| Método | Ruta                                      | Body / query                                 |
| ------ | ----------------------------------------- | -------------------------------------------- |
| GET    | `/notifications`                          | `page`, `category` opcional                  |
| GET    | `/notifications/:id`                      | —                                            |
| GET    | `/notifications/promotion/:id`            | —                                            |
| PATCH  | `/notifications/read`                     | `{ ids }`                                    |
| PATCH  | `/notifications/read-all`                 | —                                            |
| GET    | `/notifications/preferences`              | —                                            |
| PATCH  | `/notifications/preferences`              | `pushEnabled`, `system`, `offers`, `rentals` |
| POST   | `/notifications/subscriptions/register`   | `{ channel: 'EXPO', endpoint }`              |
| POST   | `/notifications/subscriptions/unregister` | `{ endpoint }`                               |

Categorías: `SYSTEM`, `OFFER` y `RENTAL`. Filtros de bandeja: `ALL`, `RENTAL`, `SYSTEM` y `OFFER`.

Destinos: `NONE`, `PRODUCT`, `PROMOTION`, `RENTAL` y `ACCOUNT`.

La bandeja responde `{ items, unreadCount, total, page, pageSize }`. El detalle responde `{ item }` y la promoción `{ promotion }`.

El comportamiento de UI y push está en [NOTIFICATIONS.md](./NOTIFICATIONS.md).

## Funcionalidades ausentes

> **NOT IMPLEMENTED IN CURRENT BACKEND:** checkout de venta.

> **NOT IMPLEMENTED IN CURRENT BACKEND:** creación y consulta de pedidos de venta.

> **NOT IMPLEMENTED IN CURRENT BACKEND:** procesamiento, autorización o captura de pagos.

> **NOT IMPLEMENTED IN CURRENT BACKEND:** historial de pedidos de venta consumible por móvil.

No diseñes rutas provisionales para estas funciones. Requieren contrato y reglas de backend antes de implementar UI conectada.

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

El cliente conserva `statusCode` y body para decisiones técnicas, pero presenta mensajes seguros en español. Distingue red, timeout, cancelación, parseo y HTTP.

Política de TanStack Query:

- `staleTime`: 30 segundos;
- máximo 2 reintentos para errores retryables;
- sin reintento para 4xx, errores de parseo o cancelaciones;
- pausa offline y refetch al reconectar o volver a foco;
- las mutaciones no reintentan automáticamente.

## TanStack Query

Antes de modificar una operación, revisa las query keys reales en [ARCHITECTURE.md](./ARCHITECTURE.md).

Después de mutar carrito, cupón, favoritos, notificaciones o renta, actualiza la caché con la respuesta del servidor o invalida las keys relacionadas. No inventes optimistic updates para operaciones con reglas complejas sin una estrategia de rollback.

## Uploads y binarios

El móvil todavía no sube recetas ni descarga documentos. Cuando se implemente:

- React Native usa URIs y objetos multipart nativos, no `File` del DOM;
- no fijes `Content-Type: multipart/form-data` con boundary manual;
- valida tamaño y tipo para UX, pero conserva la validación del backend como autoridad;
- los formatos confirmados son PDF, JPG/JPEG y PNG, con máximo de 8 MB;
- la política de descarga, preview y compartición sigue pendiente.
