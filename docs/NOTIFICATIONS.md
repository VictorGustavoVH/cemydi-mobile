# Notificaciones móviles

Estado vigente: 24 de octubre de 2026. Se verificaron NotificationsController,
NotificationQueryDto, NotificationPreferencesDto, RegisterPushDto, NotificationsService
y el payload Expo de PushDeliveryService del backend local. No se modificó el backend.

## Alcance

La app incluye bandeja de notificaciones, filtros, lectura, preferencias y registro de push para cuentas con rol `CLIENT`. Toda la información proviene del backend; el móvil no genera notificaciones ni decide a quién enviarlas.

Los contratos HTTP están en [API_INTEGRATION.md](./API_INTEGRATION.md). La implementación vive en `src/features/notifications`.

## Rutas

| Ruta                                  | Pantalla                           |
| ------------------------------------- | ---------------------------------- |
| `/perfil/notificaciones`              | Bandeja y filtros                  |
| `/perfil/notificaciones/preferencias` | Preferencias y activación de push  |
| `/perfil/notificaciones/[id]`         | Redirección desde una notificación |
| `/perfil/oferta/[id]`                 | Detalle de una oferta notificada   |

Todas las rutas privadas esperan la restauración de sesión. Si un invitado abre una de ellas, vuelve a `/inicio` con un aviso y conserva el destino permitido para después del login.

## Modelo

```ts
type CustomerNotification = {
  id: string;
  category: 'SYSTEM' | 'OFFER' | 'RENTAL';
  title: string;
  body: string;
  destinationType: 'NONE' | 'PRODUCT' | 'PROMOTION' | 'RENTAL' | 'ACCOUNT';
  destinationId: string | null;
  createdAt: string;
  readAt: string | null;
  preview?: {
    imageUrl: string | null;
    discountPercent: number | null;
  } | null;
};
```

La bandeja responde `{ items, unreadCount, total, page, pageSize }`. `unreadCount` es el contador que muestra el badge.

## Bandeja y contratos

La campana de Inicio abre `/perfil/notificaciones`, solicitando sesión cuando sea necesario. Comparte el contador sin leer de TanStack Query con la bandeja. El backend exige JWT y rol CLIENT en estos endpoints:

| Método    | Ruta                                      | Entrada                                             |
| --------- | ----------------------------------------- | --------------------------------------------------- |
| GET       | `/notifications`                          | `page?`, `category?`: SYSTEM, OFFER o RENTAL        |
| GET       | `/notifications/:id`                      | Identificador del aviso propio                      |
| PATCH     | `/notifications/read`                     | `{ ids }`, de 1 a 100 identificadores únicos        |
| PATCH     | `/notifications/read-all`                 | Sin body; toda la cuenta                            |
| GET/PATCH | `/notifications/preferences`              | PATCH: `pushEnabled`, `system`, `offers`, `rentals` |
| GET       | `/notifications/promotion/:id`            | Entero de promoción                                 |
| POST      | `/notifications/subscriptions/register`   | `{ channel: 'EXPO', endpoint }`                     |
| POST      | `/notifications/subscriptions/unregister` | `{ endpoint }`                                      |

Los servicios usan el cliente HTTP con Bearer y validación Zod. Se conservan paginación progresiva, agrupación por día, filtros, lectura optimista, rollback, preferencias automáticas y estados de carga/error/vacío/offline. El servidor verifica propietario, vigencia de promociones y preferencias.

- `useInfiniteNotifications` usa `useInfiniteQuery`, página inicial 1 y `getNextPageParam` según `page * pageSize < total`.
- Se refresca cada 30 segundos mientras la pantalla está activa y al recuperar foco. El intervalo se pausa en segundo plano.
- `gcTime` es 0: al salir se descarta la caché de la bandeja.
- Al cambiar de categoría se conserva la página anterior como placeholder solo si pertenece al mismo usuario. Nunca se muestran datos de otra cuenta.
- La lista se agrupa por día: «Hoy», «Ayer», fecha larga o «Anteriores» para fechas inválidas.
- Cada fila muestra icono por categoría, hora relativa, estado leído/no leído y, en ofertas, la vista previa con descuento.
- El texto largo se puede expandir. La expansión respeta movimiento reducido.
- El scroll infinito se dispara al acercarse al final y también tolera eventos repetidos.
- Estados: carga inicial, vacío por categoría, error con reintento, offline y error al cargar la siguiente página.

Filtros:

- `ALL` → Todas
- `RENTAL` → Rentas
- `SYSTEM` → Sistema
- `OFFER` → Ofertas

El cambio de filtro anima la lista 180 ms y se desactiva con movimiento reducido.

## Lectura

- Abrir una fila marca esa notificación como leída y navega a su destino.
- «Marcar todas como leídas» usa `PATCH /notifications/read-all`.
- La acción individual usa `PATCH /notifications/read` con `{ ids }`.
- La caché se actualiza de forma optimista y se restaura si la petición falla.
- Las acciones se bloquean sin conexión, con otra operación en curso o si la sesión cambió.
- El badge superior usa `unreadCount`, anuncia el total a accesibilidad y muestra `99+` por encima de 99.

## Destinos

`notificationDestination` decide la navegación:

| destinationType | Condición   | Destino                     |
| --------------- | ----------- | --------------------------- |
| `PRODUCT`       | id numérico | `/producto/[id]`            |
| `PROMOTION`     | id numérico | `/perfil/oferta/[id]`       |
| `RENTAL`        | id no vacío | `/perfil/renta/[id]`        |
| `ACCOUNT`       | —           | `/perfil/seguridad`         |
| `NONE` u otro   | —           | No navega; queda en bandeja |

Si el id no cumple el formato, la fila no navega y muestra su contenido en la bandeja. No se abre un detalle de fixture por error.

`/perfil/notificaciones/[id]` consulta el detalle, lo marca como leído y reemplaza la ruta por el destino. Si no hay destino, vuelve a la bandeja. `/perfil/oferta/[id]` muestra descripción, porcentaje, vigencia y productos de la promoción; cada producto abre su detalle real.

## Preferencias

`GET` y `PATCH /notifications/preferences` usan:

```ts
{
  pushEnabled: boolean;
  system: boolean;
  offers: boolean;
  rentals: boolean;
}
```

- `pushEnabled` es el interruptor general.
- `system`, `offers` y `rentals` se deshabilitan cuando `pushEnabled` es falso.
- Cada cambio guarda el objeto completo de inmediato, sin botón de guardar.
- Mientras hay un guardado en curso no se permite otro.
- La pantalla refresca cada 30 segundos y al recuperar foco, salvo que exista un cambio local pendiente.
- Sin conexión, el cambio se rechaza con un mensaje; no se simula éxito.

## Permisos y ciclo nativo

`HomeNotificationBell` solicita acceso a permisos sin bloquear la navegación. Solo lo intenta para un CLIENT autenticado. `requestNativePermissionOnce` comparte el diálogo en curso y conserva el intento en SecureStore. Un rechazo no impide consultar la bandeja; los ajustes permiten una activación explícita. Android crea el canal `cemydi` antes de solicitar permisos.

`NotificationLifecycle` se monta dentro de AuthProvider. Registra dispositivos ya autorizados al iniciar sesión, volver al primer plano o cambiar el token; no abre un diálogo automáticamente en esos eventos. Al recibir un aviso invalida la caché de notificaciones de la cuenta actual. Al desmontarse elimina los listeners y el handler de primer plano.

Solo acepta `notificationId` con letras, números, guion o guion bajo, máximo 100 caracteres. Nunca navega a una URL del payload. Una respuesta abre una sola vez `/perfil/notificaciones/[id]`; el servidor resuelve el destino y comprueba el propietario. Para invitados conserva ese destino interno durante el login. En una sesión comprobada, el `userId` numérico del payload debe corresponder a la cuenta actual. Listeners de una sesión anterior no navegan. La presentación en primer plano también exige esa correspondencia.

## Push

El registro real solo funciona en una build nativa, no en Expo Go ni en web.

Flujo:

1. La campana de Inicio solicita permiso una vez por instalación con una sesión `CLIENT`. SecureStore guarda la marca `cemydi-notification-permission-requested` para no repetir el diálogo.
2. La pantalla de preferencias permite activar el dispositivo explícitamente con «Activar en este dispositivo».
3. En Android se crea el canal `cemydi` con importancia predeterminada.
4. Se obtiene el token de Expo con `EXPO_PUBLIC_EAS_PROJECT_ID` y un timeout de 15 segundos.
5. Se registra con `POST /notifications/subscriptions/register` como `{ channel: 'EXPO', endpoint }`.
6. Antes y después del registro se comprueba que la sesión siga siendo la misma; un cambio de cuenta cancela la operación.

Mensajes esperados:

- permiso denegado: se pide revisar los ajustes del dispositivo;
- project ID ausente o inválido: push no disponible, la bandeja sigue funcionando;
- timeout o error de red: se informa y se puede reintentar.

La app expone `POST /notifications/subscriptions/unregister`, pero **ningún flujo de logout lo invoca todavía**. Hasta implementarlo, el token del dispositivo puede permanecer registrado en el backend después de cerrar sesión. No se debe afirmar que el logout desvincula el push.

## Accesibilidad

- El badge anuncia «N notificaciones sin leer» con `accessibilityLiveRegion="polite"`.
- Los encabezados de sección usan `accessibilityRole="header"`.
- Las acciones de leer y abrir tienen etiquetas explícitas y estados deshabilitados.
- Las animaciones respetan `useReducedMotion`.
- La bandeja mantiene estados de carga y error legibles por lector de pantalla.

## Pruebas

Cubiertas con Jest:

- schemas y servicio de notificaciones;
- agrupación y formato de fecha;
- fila, tabs y badge;
- bandeja con carga, vacío, error, lectura y rollback;
- preferencias y guardado;
- registro push, permisos, timeout y deduplicación;
- polling, cambio de sesión, destinos y cleanup.

Pendiente de validación nativa:

- permiso real de Android/iOS;
- recepción de push con la app abierta, en segundo plano y cerrada;
- toque en la notificación y deep link;
- desregistro del token al cerrar sesión;
- comportamiento con `pushEnabled` desactivado en el backend.

Véanse [calidad móvil](./MOBILE_QUALITY.md) y [pruebas](./TESTING.md).

Referencias: [Expo Notifications SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/)
y [configuración push](https://docs.expo.dev/push-notifications/push-notifications-setup/).
