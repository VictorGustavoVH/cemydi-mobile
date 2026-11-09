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

Los avisos de la cuenta actual se agrupan en ventanas de 1,5 segundos para
invalidar bandeja, recursos privados de cuenta y reseñas públicas una vez por
ventana. Un flujo continuo no aplaza indefinidamente la actualización. Logout,
cambio de sesión o desmontaje cancelan el temporizador pendiente, y la identidad
se comprueba otra vez al ejecutarlo. Son tres grupos de caché; la cantidad de
peticiones depende de las consultas activas, no necesariamente tres HTTP por evento.

Solo acepta `notificationId` con letras, números, guion o guion bajo, máximo 100 caracteres. Nunca navega a una URL del payload. Una respuesta abre una sola vez `/perfil/notificaciones/[id]`; el servidor resuelve el destino y comprueba el propietario. Para invitados conserva ese destino interno durante el login. En una sesión comprobada, el `userId` numérico del payload debe corresponder a la cuenta actual. Listeners de una sesión anterior no navegan. La presentación en primer plano también exige esa correspondencia.

## Push

### Expo y la mención de Firebase

El móvil solicita `getExpoPushTokenAsync` y registra `{ channel: 'EXPO', endpoint }`.
El backend envía a Expo Push Service. En Android, Expo entrega mediante Firebase
Cloud Messaging (FCM), como explica la
[documentación de Expo](https://docs.expo.dev/push-notifications/overview/).
Esto no significa que CEMYDI use Firebase Authentication, Firestore o Firebase
como backend. La bandeja propia usa NestJS/PostgreSQL y funciona sin entrega push.

Para habilitar entrega remota con la app cerrada, Expo requiere configuración FCM
del proyecto Android: archivo `google-services.json` y credenciales de envío FCM v1
en Expo/EAS. La clave de cuenta de servicio privada no se incluye en el APK ni se
versiona. Ver [configuración FCM de Expo](https://docs.expo.dev/push-notifications/fcm-credentials/).
El usuario confirmó conservar Expo con FCM únicamente para avisos; no se migran
usuarios, autenticación ni datos a Firebase. El usuario creó el proyecto Firebase
`cemydi-6b9ab` para push, separado de `cemydi-web`, que conserva Google Sign-In.
Se verificó en el navegador que FCM v1 está habilitado. Después entregó
`google-services.json`, validado para `cemydi-6b9ab` y Android `com.cemydi.app`.
Se copió a la raíz local, excluido de Git. Este JSON es configuración cliente,
no la clave privada de la cuenta de servicio de envío.

`extra.googleNativeConfigured` indica configuración de Google Sign-In; no acredita
ni deshabilita FCM. `app.config.js` permite inyectar `android.googleServicesFile`
mediante `GOOGLE_SERVICES_JSON`, con prioridad sobre el archivo local
`./google-services.json` si existe. El archivo local ignorado no se envía a EAS:
en builds remotas se necesita la variable de tipo archivo. La ausencia del campo
en el `app.json` estático no demuestra la configuración final. Se verificó en
Expo el proyecto existente `@victor_valdivia/cemydi-mobile`, ID
`390e351f-5e63-4af9-a925-49e54545f25e`: el identificador Android `com.cemydi.app`
tiene firma registrada. El usuario cargó después la clave FCM v1 y se verificó en
el dashboard de credenciales Android que pertenece a `cemydi-6b9ab`, coincidente
con el JSON cliente. Este JSON se cargó mediante la variable de tipo
archivo `GOOGLE_SERVICES_JSON` (visibilidad sensitive) del proyecto EAS para
development, preview y production. No se modificó la firma ni se copió la clave
privada al repositorio. La presencia de la credencial no acredita sus permisos IAM
efectivos ni recepción en Android físico; eso se verifica con un envío real.

El registro real solo funciona en una build nativa, no en Expo Go ni en web.

Flujo:

1. La campana de Inicio solicita permiso una vez por instalación con una sesión `CLIENT`. SecureStore guarda la marca `cemydi-notification-permission-requested` para no repetir el diálogo.
2. La pantalla de preferencias permite activar el dispositivo explícitamente con «Activar en este dispositivo».
3. En Android se crea el canal `cemydi` con importancia predeterminada.
4. Se obtiene el token de Expo con `EXPO_PUBLIC_EAS_PROJECT_ID` y un timeout de 15 segundos.
5. Se guarda `{ userId, endpoint }` en SecureStore, clave `cemydi-registered-push-token`, con `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, antes de registrar con `POST /notifications/subscriptions/register` como `{ channel: 'EXPO', endpoint }`. Si falla el almacenamiento, no se registra un dispositivo sin seguimiento local.
6. Antes y después del registro se comprueba que la sesión siga siendo la misma; un cambio de cuenta cancela la operación.

Mensajes esperados:

- permiso denegado: se pide revisar los ajustes del dispositivo;
- project ID ausente o inválido: push no disponible, la bandeja sigue funcionando;
- timeout o error de red: se informa y se puede reintentar.

`AuthProvider.logoutDetailed()` bloquea la sesión local inmediatamente y espera
también la limpieza push. En el backend, logout por access o refresh revoca la
sesión y desactiva las suscripciones de ese `sessionTokenId` en una transacción.
El registro push bloquea primero la misma fila de sesión y rechaza sesiones
revocadas/expiradas, evitando que un registro en vuelo reactive la suscripción
después del logout. No afecta a otras sesiones ni a un token reasignado a otra.

`releaseNativePush()` lee SecureStore incluso después de reiniciar la app y borra
el registro solo tras una revocación remota confirmada y si siguen coincidiendo
cuenta y versión de logout. Las operaciones de almacenamiento se serializan para
no borrar el registro de un login posterior. Si falla o queda pendiente la
revocación, se conserva el registro cifrado; si falla la limpieza local se informa.
La bandeja del sistema se intenta vaciar también tras reinicios. El cliente ya no
depende de otra petición autenticada de desregistro que compita con el logout.
Esta garantía requiere desplegar el backend corregido junto con el cliente.

El backend local vincula la suscripción al `sessionTokenId`, vuelve a comprobar
propietario, cuenta activa, preferencias y sesión antes de entregar. Los avisos
normales de sesiones revocadas/expiradas se omiten aunque la fila de suscripción
continúe activa. Existe una excepción explícita para avisos de seguridad de cambios
de credenciales, que pueden alcanzar sesiones revocadas por ese cambio. No se
acredita envío indefinido de avisos normales tras un logout confirmado solo por
observar una suscripción activa. Sin red no se puede garantizar revocación remota.

Todos los envíos Expo usan título «CEMYDI» y cuerpo «Tienes una nueva
actualización. Abre la app para consultarla», independientemente de categoría u
origen. `data` solo contiene `notificationId` y `userId`. El detalle completo se
mantiene en la bandeja autenticada. El canal Web conserva su comportamiento.
Un aviso ya aceptado por el proveedor puede llegar después del logout; no se
puede retirar desde el servidor, por lo que el contenido genérico es necesario.

### Completar FCM en Android

1. Proyecto Firebase confirmado: `cemydi-6b9ab`, FCM v1 habilitado; Google Sign-In
   sigue en `cemydi-web`. El proyecto push solo se integra para avisos.
2. Android `com.cemydi.app` y `google-services.json` local ya verificados.
   Inyectar su ruta mediante `GOOGLE_SERVICES_JSON` (archivo del entorno EAS en
   development/preview/production según la build). Ya está excluido de Git.
3. Credencial FCM v1 cargada por el usuario y verificada en el identificador
   Android del proyecto EAS existente: corresponde a `cemydi-6b9ab`. Su clave
   privada se guarda en Expo, nunca en `extra`,
   `EXPO_PUBLIC_*`, el APK ni Git; no debe pegarse en chats o logs. La creación de
   credenciales requiere intervención del responsable.
4. Confirmar que ambos archivos corresponden al mismo proyecto, sin confundir
   el JSON público de configuración con el JSON privado de cuenta de servicio.
5. Reconstruir la app con CNG y probar un Android físico: primer plano, segundo
   plano y proceso cerrado; toque con sesión válida, logout/reinicio y cambio de
   cuenta. Un cierre forzado desde Ajustes tiene restricciones distintas a quitar
   la app de recientes; no se promete recepción en ese estado.

La política Android vigente usa HTTPS con CA del sistema, sin requisito de pins
de respaldo. La configuración FCM y una suite Jest verde no acreditan recepción
física. Ver [seguridad Android](./ANDROID_RELEASE_SECURITY.md).

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

## Revisión del flujo de reseñas y rentas — 1 de noviembre de 2026

- `notifyRentalStatus` ya se llama desde la transacción de cambios de estado de
  renta en `RentalsService`. Persiste bandeja y trabajos de push, sujetos a las
  preferencias de cliente y a la automatización `rentalStatus` del administrador.
- Con autorización del usuario se añadieron rechazo y avisos de moderación en
  backend/panel web. `PATCH /reviews/:id/approve` y `PATCH /reviews/:id/reject`
  requieren ADMIN; persisten estado, bandeja y outbox push en una transacción.
  Repetir el mismo estado no repite el aviso. Un cambio concurrente devuelve 409.
- Los avisos de reseñas usan categoría `SYSTEM`, origen `REVIEW_STATUS` y destino
  `PRODUCT` con el id del producto; web y móvil ya resuelven ese destino. Push
  respeta las preferencias `pushEnabled` y `system`; la bandeja conserva el aviso.
  El rechazo no elimina la reseña: el cliente puede editarla y reenviarla.
- Al recibir un push de la cuenta actual, `NotificationLifecycle` invalida bandeja,
  recursos privados de cuenta (rentas y reseñas) y reseñas públicas. Los avisos de
  otra cuenta y los listeners de sesiones anteriores no invalidan estos datos.
- La configuración Expo local efectiva tiene proyecto EAS y plugin
  `expo-notifications` (SDK 57.0.31 / notifications 57.0.24), pero carece de
  `android.googleServicesFile`. No se verificaron credenciales remotas FCM/APNs.
  No se ha acreditado recepción física con la app en segundo plano o cerrada.

El formulario de escritura reutiliza `AppSheet`, como Configurar renta. La ruta es
transparente para conservar la pantalla de origen detrás del panel. Se mantiene un
único panel para confirmar descarte, sin superponer otro modal; se conservan
validación, borrador durante errores/offline, bloqueo de doble envío y control de
sesión. Las indicaciones de contenido no muestran términos como HTML o scripts.

## Revisión de seguridad — 8 de noviembre de 2026

Se corrigió la actualización por ráfagas y se contrastó el informe con el
transporte Expo y los controles de sesión del backend. La suite completa aprobó
107 suites y 665 pruebas; lint, TypeScript, formato y `git diff --check` aprobados.
Evidencia: `test-results/security/notifications-batching-jest.json` y `.log`.
Las pruebas verifican que treinta avisos de la misma cuenta producen una sola
actualización de los tres grupos por ventana, que otra cuenta no la provoca y
que una actualización pendiente se cancela al cerrar sesión.

Posteriormente se implementaron el registro cifrado, cleanup esperado sin retrasar
el bloqueo local, revocación transaccional de suscripciones y rechazo de registro
tardío en backend, y texto genérico para todo Expo Push. Se añadieron regresiones
de reinicio, logout pendiente, cambio de cuenta, fallos de almacenamiento y
privacidad del payload, además de concurrencia real con PostgreSQL local.
Validación posterior: suite móvil completa, 107 suites/673 pruebas, más 19 pruebas
enfocadas (incluyen dos regresiones adicionales de espera remota y nuevo login).
Lint, TypeScript y formato móvil aprobados. Evidencia de la suite completa:
`test-results/security/notifications-security-jest.json` y `.log`. Backend:
49 pruebas enfocadas, lint de archivos modificados, build Nest y prueba PostgreSQL
local aprobados. El TypeScript global del backend que incluye todos los `.spec.ts`
mantiene errores previos de fixtures en otros módulos y un cast previo de
`AuthConfigService`; el build de producción excluye tests y aprobó. No se cambiaron
esos contratos ni se ocultan esos errores con opciones del compilador.
El usuario proporcionó después el acceso al proyecto Firebase y el JSON Android;
la configuración cliente local quedó integrada y el archivo se provisionó en los
tres entornos EAS. La configuración efectiva de Expo, prioridad de la ruta EAS,
proyecto Firebase y paquete Android se comprobaron; las 15 pruebas de registro y
limpieza push aprobaron. El usuario cargó la credencial privada directamente en
Expo; se verificó su asociación con `com.cemydi.app` y el proyecto `cemydi-6b9ab`
el 8 de noviembre de 2026. Siguen pendientes despliegue del backend y recepción
en Android físico con una nueva build. Se retiró con autorización el bloqueo de Release por
segundo pin TLS; se conserva el requisito de HTTPS y firma dedicada. El agente no generó claves privadas ni builds.
