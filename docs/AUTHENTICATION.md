# Autenticación de CEMYDI Mobile

## Decisión aprobada — 16 de octubre de 2026

El usuario aprobó tokens explícitos para móvil y la adaptación del backend. La aplicación usa access token en memoria y refresh rotatorio en `expo-secure-store` al seleccionar «Mantener sesión iniciada». Sin esa opción, ambos tokens viven solo en memoria durante el proceso. No se guardan contraseñas, códigos OTP ni credenciales en TanStack Query, AsyncStorage, rutas o logs.

Se verificó Expo instalado 57.0.31; SecureStore se instaló con `npx expo install` y su config plugin queda en `app.json`, conservando CNG. Se contrastaron los tipos instalados del SDK 57 y la [documentación oficial de SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/). iOS usa `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; el plugin configura la exclusión del backup Android. Se requiere validación nativa en ambas plataformas.

## Contratos móviles

`MobileAuthController` reutiliza AuthService/AuthSessionService: validación de contraseña, estado, correo verificado, bloqueo de intentos, sesiones, duración y revocación siguen en el servidor. El cambio de credenciales agrega una migración aditiva para dos propósitos OTP y avisos de seguridad.

| Método | Ruta                   | Body                 | Respuesta                                    |
| ------ | ---------------------- | -------------------- | -------------------------------------------- |
| POST   | `/auth/mobile/login`   | `correo`, `password` | Sesión móvil                                 |
| POST   | `/auth/mobile/google`  | `idToken`            | Sesión móvil desde Google Sign-In nativo     |
| POST   | `/auth/mobile/refresh` | `refreshToken`       | Sesión móvil con refresh rotado              |
| POST   | `/auth/mobile/logout`  | `refreshToken`       | `{ message }`; revoca la sesión              |
| GET    | `/users/me`            | —                    | `{ user }` o `{ user: null }`, usando Bearer |

Sesión móvil: `{ user, accessToken, refreshToken, accessExpiresInMs, refreshExpiresInMs }`. El usuario contiene `id`, `nombre`, `correo`, `activo`, `rol` (`ADMIN` o `CLIENT`), `emailVerified`, `emailVerifiedAt`. Los intervalos provienen del servidor. El refresh es un valor aleatorio de 32 bytes codificado como 64 caracteres hexadecimales; solo su hash se guarda en el backend.

Los endpoints móviles no emiten cookies y llevan `Cache-Control: no-store`. Login y refresh conservan los límites de frecuencia del backend; logout reutiliza el límite de refresh. Google canjea el `idToken` por el mismo tipo de sesión. DTO de refresh obligatorio, validado y sin campos extra. La rotación actualiza de forma condicional el hash vigente: dos solicitudes con el mismo refresh no pueden completarse ambas.

`httpClient` admite `authenticated: true`: envía Bearer con `credentials: omit`, coordina una única renovación concurrente y repite la operación como máximo una vez. Si vuelve a recibir 401, expira la sesión. Una petición de una sesión anterior no se repite con otra cuenta. Requests públicos siguen sin requerir sesión. HTTPS es obligatorio en producción según `src/config/env.ts`.

## Google Sign-In nativo

Login y registro ofrecen «Continuar con Google». El móvil usa `react-native-nitro-google-signin` para obtener un `idToken` en Android o iOS y lo canjea en `POST /auth/mobile/google` por la misma sesión móvil que el login con contraseña.

Requisitos de configuración:

- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`: cliente Web de Google Cloud Console. Es obligatorio también para Android Credential Manager.
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`: cliente iOS, requerido en iOS. `app.config.js` deriva el `iosUrlScheme` del plugin.
- Package Android `com.cemydi.app` y bundle identifier iOS `com.cemydi.app` deben coincidir con los registrados en Google Cloud Console.
- En Android, registrar un cliente OAuth Android con el paquete y SHA-1 de la firma instalada, en el mismo proyecto que el cliente Web. Un registro incorrecto puede permitir elegir una cuenta y cancelar después, sin entregar identidad a la app.
- `app.config.js` expone `extra.googleNativeConfigured` solo cuando la configuración mínima existe.

Google Sign-In no funciona en Expo Go: requiere una build nativa con los identificadores y credenciales correctos. Si falta configuración, el botón informa que Google no está disponible en esa versión; no simula una sesión.

Los endpoints web `/auth/google` y `/auth/google/callback` siguen siendo exclusivos del navegador y no se usan en móvil.

El botón Android inicia `presentExplicitSignIn()` por ser una acción expresa del
usuario. Solo una respuesta con `idToken` permite llamar al backend y navegar;
cancelaciones y fallos muestran un toast sin simular sesión. Los logs de diagnóstico
no contienen tokens ni datos de la cuenta.

Diagnóstico nativo del 31 de octubre de 2026: en Huawei STK-LX3, Android 10,
Credential Manager devuelve `[16] Account reauth failed` tras seleccionar cuenta,
antes del canje con el backend. Se comprobó en Google Cloud que el cliente Web de
la app coincide con el proyecto `cemydi-web`, pero el único cliente Android estaba
registrado con otra firma, SHA-1
`5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`.
El APK instalado usa
`com.cemydi.app` y SHA-1 público
`D1:F4:6B:55:43:F8:56:38:36:5B:9A:E7:68:1B:AF:1E:7A:40:EA:5F`.
Con confirmación del usuario se creó el cliente adicional «Cemydi Android Release
local» para esa firma; el cliente anterior se conservó. La consola confirmó su
creación y advierte propagación de 5 minutos a algunas horas. El usuario confirmó
que pudo entrar con Google en el mismo APK después del cambio. No se cambió la
firma instalada ni se borraron datos.
Ver [autenticación del cliente Android](https://developers.google.com/android/guides/client-auth).

## Formularios y códigos

- Registro usa `POST /auth/register` con solo `nombre`, `correo`, `password`; no crea sesión. Mensaje genérico, seguido de OTP.
- Verificación usa `POST /auth/email-verification/confirm-code` con `correo`, `codigo`. Login y registro incluyen «Verificar cuenta» en el menú de tres puntos del encabezado para solicitar/reanudar con `/auth/email-verification/send`, sin exigir contraseña.
- Recuperación usa `/auth/password-reset/request`, `/auth/password-reset/verify-code` y `/auth/password-reset/confirm` con `correo`, `codigo`, `newPassword`.
- Reenvío usa el endpoint de cada propósito. Espera visual de 60 segundos; el servidor aplica expiración, intentos y rate limiting. El móvil no inventa vencimiento para la solicitud inicial; después de verificar recuperación usa `expiresAt` real.
- El código confirmado de recuperación permanece únicamente en el cierre del servicio para el request final. No aparece en rutas, estado público ni almacenamiento persistente; cancelar, reenviar y completar lo elimina. Reiniciar el proceso requiere solicitar otro código.
- Cambio de contraseña revoca sesiones en backend, elimina la credencial local y devuelve a login. El servidor vuelve a comprobar el código al confirmar; la validación previa no es autorización local.
- Los formularios conservan React Hook Form/Zod, AppInput, AppButton, PasswordField, errores accesibles y loading sin reintentos automáticos. Red/timeout, código inválido, 429 y errores contractuales no simulan éxito.
- Borradores guardan solo nombre/correo; los campos de contraseña se vacían al remontar. «Mantener sesión iniciada» persiste sesión, no contraseña.

## Ciclo de sesión y navegación

Login y registro comparten `useAuthRedirect`, que actúa solo con foco y sesión
comprobada, tanto para contraseña como Google. Después del acceso consulta el perfil
con `useProfile` y `GET /users/me`: si falta teléfono o dirección (incluido texto en
blanco), abre `/perfil`; si ambos están completos, abre `/inicio`. Esta regla prevalece
sobre un destino privado solicitado antes del login. La pantalla oculta sus campos
mientras comprueba el perfil y navega una sola vez. Si la consulta falla o queda offline,
abre Perfil para permitir consultar/reintentar desde allí. No cambia tokens ni transporte.
El flujo de acceso se retira del historial; el contenido del carrito y la sesión se
conservan. Las reseñas se pueden retomar desde sus accesos después del login.

`AuthProvider` sustituye el provider de muestra. Distingue carga inicial, invitado, autenticado, sesión expirada y error de restauración. Al abrir la app restaura mediante refresh; al volver a foreground revalida `/users/me`. Una pérdida de red conserva la credencial segura y permite reintentar, sin presentar datos sensibles como sesión comprobada durante la restauración. Perfil y revisión del carrito esperan la comprobación o dirigen al login sin alterar la pantalla de origen. Una sección privada de Perfil abierta por un invitado (enlace directo, «Atrás» desde el login o sesión vencida) no muestra una pantalla intermedia: vuelve a `/inicio` con un aviso. `returnToAuthDestination` centraliza el retorno: si hay formularios de acceso apilados, cierra todos los consecutivos (login, registro, OTP y recuperación) con `dismiss` consultando el estado del navegador, conservando el producto o pantalla de origen y cambia de pestaña con `navigate` (o apila una subruta de perfil con `push`); si no hay stack, reemplaza login por el destino.

El destino posterior al acceso es siempre `/perfil` o `/inicio` según los datos del perfil. La app no conserva la pantalla privada que abrió el login: las reseñas y los avisos se retoman desde sus accesos una vez autenticado.

El login y la restauración comprueban señales de root o jailbreak mediante `expo-device`; si se detectan, se impide abrir sesión y se limpia el estado local. Es una medida disuasoria, no una frontera de seguridad: un dispositivo comprometido puede eludirla y su validación requiere dispositivos de referencia.

Al revalidar `/users/me`, una identidad ausente o con `activo: false` expira la
sesión y elimina access, refresh y credencial persistida. La suscripción existente
de `AuthProvider` cancela consultas y limpia la caché al retirar la identidad. Una
edición concurrente del perfil no descarta esa desactivación; una respuesta de una
sesión anterior tampoco puede cerrar la cuenta recién iniciada. Los fallos de red
conservan el tratamiento previo de conectividad. La autorización sigue en backend:
su `JwtStrategy` consulta el estado actual de la cuenta y refresh también lo exige.

### Privacidad de credenciales en Android

Por decisión del usuario, el bloqueo de capturas se aplica a pantallas de
credenciales y, desde su confirmación del 8 de noviembre de 2026, también a Datos
personales (`/perfil/editar`) por teléfono y domicilio. `CredentialScreenProtection`
usa `expo-screen-capture` 57.0.4 para
activar `FLAG_SECURE` con foco de navegación, antes de mostrar los campos. Se aplica
a `AuthLayout` (login, registro, recuperación, OTP y nueva contraseña), cambios de
correo/contraseña y eliminación de cuenta con OTP. Si falla la activación, oculta
los campos y ofrece reintento o retorno. Cada foco usa una clave independiente,
liberada al salir o desmontar, incluso si la activación seguía pendiente. Mantiene
el bloqueo al enviar la app a segundo plano: `AppState` no libera la protección.
`PasswordField` vuelve a ocultar la contraseña y cierra su ayuda al perder actividad.

Inicio, catálogo y perfil general permiten capturas. El alcance elegido no protege
su información personal en multitarea. No se solicita acceso a fotos o disco; se
bloquean `READ_MEDIA_IMAGES` y los permisos de almacenamiento en `app.json`.
El permiso normal `DETECT_SCREEN_CAPTURE` viene del módulo para Android 14+; no se
registra ningún listener de capturas desde la aplicación.

Requiere reconstruir el APK por la nueva dependencia nativa. No instalar solo el
bundle en un binario anterior. Verificar captura, grabación, multitarea y retorno
entre formularios y catálogo en el dispositivo objetivo. Jest y CNG no acreditan
esa aceptación. iOS sigue pendiente y no activa esta protección Android.
Referencia: [ScreenCapture de Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/screen-capture/).

El perfil muestra nombre/correo reales y «Cerrar sesión». Logout bloquea de inmediato las operaciones de la sesión saliente, limpia memoria y caché privada, y elimina el refresh de SecureStore. Si la eliminación falla, intenta sustituirlo por un marcador que impide restaurar la sesión; si tampoco puede confirmar ese paso, muestra error y permite reintentar. La revocación remota se intenta sin bloquear el cierre local y se informa cuando falla o sigue pendiente. Una rotación tardía se revoca y no puede restaurar el estado. Si SecureStore rechaza guardar el refresh rotado, la sesión continúa en memoria con el token nuevo (el anterior ya fue invalidado en el servidor), pero al reiniciar se pierde; no se reintroduce el token anterior. La integración del carrito se describe en CART.md.

## Cambios de credenciales de perfil

`PATCH /users/me` acepta solo `nombre`, `telefono` y `direccion`. Correo y contraseña usan `/users/me/email-change/{request,resend,confirm}` y `/users/me/password-change/{request,resend,confirm}`. La solicitud exige contraseña actual; el correo nuevo recibe un OTP de ocho dígitos para cambio de correo, y el correo vigente lo recibe para cambio de contraseña. El backend aplica 60 segundos entre envíos, expiración e intentos limitados. Tras confirmar, revoca todas las sesiones. El móvil limpia su sesión y vuelve a login; si la limpieza local falla después de la revocación remota, conserva el mensaje de éxito y la restauración descarta la credencial ya inválida.

## Compatibilidad web y CSRF

La web conserva `/auth/login`, `/auth/refresh`, `/auth/logout` y cookies HTTP-only `cemydi_access`/`cemydi_refresh`; no recibe tokens en JSON. CSRF sigue requiriendo double-submit para mutaciones basadas en cookies. Solo un request Bearer sin cookies access/refresh queda exento de CSRF; sus guards JWT y de rol siguen obligatorios. Requests mixtos conservan CSRF porque la estrategia JWT prioriza cookie.

El backend actual exige usuario activo y correo verificado. Roles y permisos permanecen definidos en backend; el panel administrativo no forma parte de la app.

## Pendientes explícitos

El usuario confirmó Google Sign-In en el APK Release Android tras registrar su
firma en Google Cloud. Sigue pendiente la validación nativa en iOS y los demás
recorridos de sesión. La configuración de Google Cloud Console, el SHA-1 del
keystore y los client IDs no se validan solo con Jest.

Siguen pendientes app/universal links para tokens de correo; el recorrido móvil implementado usa códigos reales de ocho dígitos.

El scheme personalizado `cemydi://` no transporta tokens ni secretos: solo abre rutas internas cuya lectura sigue protegida por el servidor. Por eso un hipotético registro ajeno del scheme no expone sesión ni datos. Antes de mover cualquier token a un enlace serán obligatorios app/universal links con verificación de dominio (App Links/Associated Domains); no se añaden esquemas alternativos para sortear esa verificación.

No se considera validado el recorrido real de correo ni la persistencia nativa solo por pasar Jest o exportar bundles. Validar con backend actualizado y correo de pruebas: registro, OTP/reenvío, login persistente/no persistente, reinicio, refresh, revocación, recuperación, logout, offline y foreground en Android e iOS. Ver `TESTING.md`.

## Cancelar login — 3 de noviembre de 2026

La flecha de login usa `cancelAuthFlow`: cierra los formularios de acceso y conserva
la pantalla de origen. Si no existe una pantalla anterior, vuelve a `/inicio`.
Cancelar no ejecuta la navegación posterior al acceso; `useAuthRedirect` elige
Perfil o Inicio tras comprobar la sesión y los datos del perfil.
Atrás del sistema conserva el historial nativo de la pantalla de origen.

AccountAccessBoundary se evalúa antes del encabezado de cuenta. Un invitado no ve
«Mi perfil» ni un spinner «Volviendo al inicio…»; el guard redirige con foco y
restablece su bloqueo al perderlo, incluso después de un cierre de sesión explícito.
Se mantienen restauración, errores de sesión y política de acceso existentes.

El desplegable «Opciones de acceso» del encabezado de login y registro agrupa «Verificar cuenta» y
«Ayuda». La verificación utiliza el correo del formulario, sin exigir contraseña;
si no es válido, el menú cierra y se muestra/enfoca el error de correo. Ayuda abre
`/perfil/ayuda`, que es pública. El correo y el borrador del formulario se conservan al
volver desde Ayuda. El menú no altera la regla Perfil/Inicio posterior al acceso.
