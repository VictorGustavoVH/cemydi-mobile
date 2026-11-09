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
- `pageSize`: el móvil usa 10 en catálogo.

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

- `GET /reviews/product/:productId/mine` requiere JWT y devuelve `{ review: null | { id, rating, comment, status, createdAt, updatedAt } }`.
- `POST /reviews` requiere JWT; acepta `{ productId: entero positivo, rating: entero de 1 a 5, comment: texto de 5 a 500 caracteres tras trim }` y responde `{ message, review }` con los mismos campos. Hace upsert por usuario/producto; crear o editar deja la reseña en `PENDING` y retira una publicación previa hasta su nueva aprobación.

El móvil permite escribir desde el detalle del producto y editar desde Mis reseñas.
`reviewService` usa Bearer y valida la respuesta; `useWriteReview` verifica identidad
más versión de sesión antes y después del envío, impide doble envío y no encola
escrituras offline. Invalida las reseñas propias y las públicas del producto tras
confirmar. El formulario conserva borrador y muestra errores de contenido conocidos.

El schema local también rechaza etiquetas HTML y esquemas de script evidentes
antes del POST, conservando el borrador y mostrando «Escribe tu opinión solo con
texto». Es una validación orientativa de entrada: no replica la normalización,
lista de palabras o moderación del backend, no elimina contenido silenciosamente
y no reemplaza el render como texto. Comentarios superiores a 500 caracteres se
rechazan por longitud sin ejecutar la expresión de detección sobre ellos.

El usuario autorizó paginación opcional en `GET /reviews/product/:productId`.
Sin parámetros conserva `{ reviews, summary }` completo para la web y clientes
anteriores. Al enviar `page` o `pageSize`, devuelve además
`pagination: { page, pageSize, total, totalPages, hasPreviousPage, hasNextPage }`.
Los valores por defecto son página 1 y tamaño 10; `page` admite enteros 1–1 000 000
y `pageSize` 1–50. Entradas vacías, fraccionarias, repetidas o fuera de rango dan 400. No cambian autenticación ni rutas de escritura.

El móvil solicita siempre `page=N&pageSize=10`, incluidas las valoraciones para
las tarjetas; la respuesta debe confirmar página, tamaño, resumen y continuidad.
Si el servidor no ofrece el contrato paginado, la app presenta el error existente;
no reintenta descargando el listado completo. Desplegar este backend antes de
publicar el cliente actualizado. El modo antiguo sigue sin límite total por
compatibilidad y no debe describirse como protección global contra DoS.

Cada página selecciona solo los campos públicos y ordena por `createdAt DESC,
id DESC`. Su resumen cuenta/promedia todas las reseñas aprobadas del producto
mediante agregación SQL dentro de una transacción RepeatableRead junto con la
lectura de esa página. Una página fuera del total queda vacía con el resumen global.
Las reseñas pendientes/rechazadas no se incluyen.

`useProductReviews` usa una caché infinita `['reviews', 'product', id, 'pages']`,
separada del recurso plano de valoraciones. Las invalidaciones existentes por
prefijo siguen cubriendo ambos. El detalle muestra primero dos opiniones de las
diez consultadas; «Ver más» despliega la página ya cargada y «Cargar más reseñas»
pide la siguiente. Conserva las opiniones previas ante errores, permite reintentar
la misma página, bloquea carga offline y deduplica IDs entre páginas. Pulsaciones
rápidas comparten la petición en curso mediante `cancelRefetch: false`. El contador
y promedio usan el resumen global, no la cantidad de filas descargadas.

El cache crece solo con páginas solicitadas por el usuario; no hay un máximo total
para las páginas cargadas manualmente. La paginación por offset puede cambiar si
se publican o retiran reseñas durante la navegación: se deduplican IDs y las
invalidaciones/revalidaciones recuperan el listado actual, sin prometer un snapshot
único entre peticiones independientes.

La comprobación local de contenido aprobó antes 109 suites/704 pruebas
(`test-results/security/review-input-jest.json` y `.log`). La validación de la
paginación se registra con su ejecución propia, sin atribuirla a esas cifras.

El backend valida la política de contenido antes de persistir y aprobar: rechaza
palabras ofensivas de una lista mantenida (con variantes comunes de mayúsculas,
acentos, separadores, leetspeak y caracteres invisibles), HTML, esquemas de script,
patrones comunes de JavaScript/SQL y controles peligrosos. Inspecciona hasta tres
capas de codificación sin ejecutar ni reescribir el comentario original. Es un
filtro heurístico de contenido, no una garantía de detectar cualquier ataque o
insulto. La moderación humana, la representación como texto y las consultas Prisma
parametrizadas siguen siendo obligatorias. No se ejecuta código de las reseñas.

Los cambios de protección están en `cemydi-backend/src/modules/reviews/review-content.ts`
y deben desplegarse en el servidor para proteger los envíos reales. Referencias:
[validación de entradas OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
y [salida segura OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html).

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

| Método | Ruta                                       | Uso móvil                                                        |
| ------ | ------------------------------------------ | ---------------------------------------------------------------- |
| GET    | `/rentals/mine`                            | Lista paginada; el móvil usa `pageSize=8`                        |
| GET    | `/rentals/mine/:id`                        | Detalle propio                                                   |
| PATCH  | `/rentals/:id/cancel`                      | Cancela una solicitud pendiente cuando el backend lo permite     |
| POST   | `/rentals/from-cart`                       | Envía todas las rentas del carrito con requisitos y aceptaciones |
| POST   | `/rentals/cart-items/:itemId/prescription` | Adjunta o reemplaza una receta del carrito mediante multipart    |
| DELETE | `/rentals/cart-items/:itemId/prescription` | Elimina una receta del carrito                                   |

Estados confirmados de renta: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `DELIVERED` y `RETURNED`.

Estados de depósito: `PENDING`, `RETURNED`, `RETAINED` y `PARTIALLY_RETAINED`.

El detalle incluye folio, fechas, importes, método de entrega, domicilio, notas, estado de depósito e items con su receta asociada.

`POST /rentals/from-cart` y `POST`/`DELETE /rentals/cart-items/:itemId/prescription` se consumen desde la solicitud móvil. Ver [RENTALS.md](./RENTALS.md) para DTO, multipart y manejo de resultados inciertos. La descarga de documentos sigue pendiente.

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

El móvil sube/elimina recetas del carrito; la descarga sigue pendiente. Ver [RENTALS.md](./RENTALS.md). Reglas de multipart:

- React Native usa URIs y objetos multipart nativos, no `File` del DOM;
- no fijes `Content-Type: multipart/form-data` con boundary manual;
- valida tamaño y tipo para UX, pero conserva la validación del backend como autoridad;
- los formatos confirmados en el backend actual son PDF, JPG/JPEG, PNG y WebP, con máximo de 8 MB;
- la política de descarga, preview y compartición sigue pendiente.
