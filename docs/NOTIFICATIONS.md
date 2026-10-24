# Notificaciones móviles

Estado vigente: 24 de octubre de 2026. Se verificaron NotificationsController,
NotificationQueryDto, NotificationPreferencesDto, RegisterPushDto, NotificationsService
y el payload Expo de PushDeliveryService del backend local. No se modificó el backend.

## Bandeja y contratos

La campana de Inicio abre `/perfil/notificaciones`, solicitando sesión cuando sea
necesario. Comparte el contador sin leer de TanStack Query con la bandeja. El backend
exige JWT y rol CLIENT en estos endpoints:

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

Los servicios existentes usan el cliente HTTP con Bearer y validación Zod. Se
conservan paginación progresiva, agrupación por día, filtros, lectura optimista,
rollback, preferencias automáticas y estados de carga/error/vacío/offline.
El servidor verifica propietario, vigencia de promociones y preferencias.

## Permisos y ciclo nativo

`HomeNotificationBell` solicita acceso a permisos sin bloquear la navegación.
Solo lo intenta para un CLIENT autenticado. `requestNativePermissionOnce`
comparte el diálogo en curso y conserva el intento en SecureStore. Un rechazo
no impide consultar la bandeja; los ajustes permiten una activación explícita.
Android crea el canal antes de solicitar permisos.

`NotificationLifecycle` se monta dentro de AuthProvider. Registra dispositivos
ya autorizados al iniciar sesión, volver al primer plano o cambiar el token;
no abre un diálogo automáticamente en esos eventos. Al recibir un aviso invalida
la caché de notificaciones de la cuenta actual. Al desmontarse elimina los
listeners y el handler de primer plano.

Solo acepta `notificationId` con letras, números, guion o guion bajo, máximo
100 caracteres. Nunca navega a una URL del payload. Una respuesta abre una sola
vez `/perfil/notificaciones/[id]`; el servidor resuelve el destino y comprueba
el propietario. Para invitados conserva ese destino interno durante el login.
En una sesión comprobada, el `userId` numérico del payload debe corresponder a
la cuenta actual. Listeners de una sesión anterior no navegan. La presentación
en primer plano también exige esa correspondencia.

## Configuración y validación pendiente

Expo instalado: 57.0.31; expo-notifications y su plugin ya estaban presentes.
El módulo se carga de forma diferida y no simula éxito cuando no está disponible.
El flujo push requiere un development build o una distribución en dispositivo
físico; no se declara validado mediante Expo Go.

- Vincular el proyecto EAS mediante `EXPO_PUBLIC_EAS_PROJECT_ID`.
- Configurar FCM/APNs y firma para los identificadores de app.json.
- `GOOGLE_SERVICES_JSON` admite una ruta privada; no versionar credenciales.
- Reconstruir mediante CNG después de cambios de plugins nativos.
- Probar permisos concedidos/rechazados, reinstalación, recepción con app activa,
  en segundo plano y cerrada, cambio de cuenta y logout en Android/iOS.

Jest comprueba permisos simulados, contador, rollback, destinos, deduplicación,
cambio de sesión y cleanup. No sustituye la entrega push real ni la revisión
visual. Véanse [calidad móvil](./MOBILE_QUALITY.md) y [pruebas](./TESTING.md).

Referencias: [Expo Notifications SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/)
y [configuración push](https://docs.expo.dev/push-notifications/push-notifications-setup/).
