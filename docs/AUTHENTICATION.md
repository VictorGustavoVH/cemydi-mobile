# Autenticación de CEMYDI Mobile

## Decisión aprobada — 16 de octubre de 2026

El usuario aprobó tokens explícitos para móvil y la adaptación del backend. La aplicación usa access token en memoria y refresh rotatorio en `expo-secure-store` al seleccionar «Mantener sesión iniciada». Sin esa opción, ambos tokens viven solo en memoria durante el proceso. No se guardan contraseñas, códigos OTP ni credenciales en TanStack Query, AsyncStorage, rutas o logs.

Se verificó Expo instalado 57.0.28; SecureStore se instaló con `npx expo install` y su config plugin queda en `app.json`, conservando CNG. Se contrastaron los tipos instalados del SDK 57 y la [documentación oficial de SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/). iOS usa `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; el plugin configura la exclusión del backup Android. Se requiere validación nativa en ambas plataformas.

## Contratos móviles

`MobileAuthController` reutiliza AuthService/AuthSessionService: validación de contraseña, estado, correo verificado, bloqueo de intentos, sesiones, duración y revocación siguen en el servidor. El cambio de credenciales agrega una migración aditiva para dos propósitos OTP y avisos de seguridad.

| Método | Ruta                   | Body                 | Respuesta                                    |
| ------ | ---------------------- | -------------------- | -------------------------------------------- |
| POST   | `/auth/mobile/login`   | `correo`, `password` | Sesión móvil                                 |
| POST   | `/auth/mobile/refresh` | `refreshToken`       | Sesión móvil con refresh rotado              |
| POST   | `/auth/mobile/logout`  | `refreshToken`       | `{ message }`; revoca la sesión              |
| GET    | `/users/me`            | —                    | `{ user }` o `{ user: null }`, usando Bearer |

Sesión móvil: `{ user, accessToken, refreshToken, accessExpiresInMs, refreshExpiresInMs }`. El usuario contiene `id`, `nombre`, `correo`, `activo`, `rol` (`ADMIN` o `CLIENT`), `emailVerified`, `emailVerifiedAt`. Los intervalos provienen del servidor. El refresh es un valor aleatorio de 32 bytes codificado como 64 caracteres hexadecimales; solo su hash se guarda en el backend.

Los tres endpoints móviles no emiten cookies y llevan `Cache-Control: no-store`. Login y refresh conservan los límites de frecuencia del backend; logout reutiliza el límite de refresh. DTO de refresh obligatorio, validado y sin campos extra. La rotación actualiza de forma condicional el hash vigente: dos solicitudes con el mismo refresh no pueden completarse ambas.

`httpClient` admite `authenticated: true`: envía Bearer con `credentials: omit`, coordina una única renovación concurrente y repite la operación como máximo una vez. Si vuelve a recibir 401, expira la sesión. Una petición de una sesión anterior no se repite con otra cuenta. Requests públicos siguen sin requerir sesión. HTTPS es obligatorio en producción según `src/config/env.ts`.

## Formularios y códigos

- Registro usa `POST /auth/register` con solo `nombre`, `correo`, `password`; no crea sesión. Mensaje genérico, seguido de OTP.
- Verificación usa `POST /auth/email-verification/confirm-code` con `correo`, `codigo`. Login incluye «Verificar mi correo» para solicitar/reanudar con `/auth/email-verification/send`, sin exigir contraseña.
- Recuperación usa `/auth/password-reset/request`, `/auth/password-reset/verify-code` y `/auth/password-reset/confirm` con `correo`, `codigo`, `newPassword`.
- Reenvío usa el endpoint de cada propósito. Espera visual de 60 segundos; el servidor aplica expiración, intentos y rate limiting. El móvil no inventa vencimiento para la solicitud inicial; después de verificar recuperación usa `expiresAt` real.
- El código confirmado de recuperación permanece únicamente en el cierre del servicio para el request final. No aparece en rutas, estado público ni almacenamiento persistente; cancelar, reenviar y completar lo elimina. Reiniciar el proceso requiere solicitar otro código.
- Cambio de contraseña revoca sesiones en backend, elimina la credencial local y devuelve a login. El servidor vuelve a comprobar el código al confirmar; la validación previa no es autorización local.
- Los formularios conservan React Hook Form/Zod, AppInput, AppButton, PasswordField, errores accesibles y loading sin reintentos automáticos. Red/timeout, código inválido, 429 y errores contractuales no simulan éxito.
- Borradores guardan solo nombre/correo; los campos de contraseña se vacían al remontar. «Mantener sesión iniciada» persiste sesión, no contraseña.

## Ciclo de sesión y navegación

`AuthProvider` sustituye el provider de muestra. Distingue carga inicial, invitado, autenticado, sesión expirada y error de restauración. Al abrir la app restaura mediante refresh; al volver a foreground revalida `/users/me`. Una pérdida de red conserva la credencial segura y permite reintentar, sin presentar datos sensibles como sesión comprobada durante la restauración. Perfil y revisión del carrito esperan la comprobación o dirigen al login, conservando destino. Una sección privada de Perfil abierta por un invitado (enlace directo, «Atrás» desde el login o sesión vencida) no muestra una pantalla intermedia: vuelve a `/inicio` con un aviso. `returnToAuthDestination` centraliza el retorno: si el login está apilado, lo cierra con `dismiss` y cambia de pestaña con `navigate` (o apila una subruta de perfil con `push`); si no hay stack, reemplaza login por el destino.

El perfil muestra nombre/correo reales y «Cerrar sesión». Logout bloquea de inmediato las operaciones de la sesión saliente, limpia memoria y caché privada, y elimina el refresh de SecureStore. Si la eliminación falla, intenta sustituirlo por un marcador que impide restaurar la sesión; si tampoco puede confirmar ese paso, muestra error y permite reintentar. La revocación remota se intenta sin bloquear el cierre local y se informa cuando falla o sigue pendiente. Una rotación tardía se revoca y no puede restaurar el estado. La integración del carrito se describe en CART.md.

## Cambios de credenciales de perfil

`PATCH /users/me` acepta solo `nombre`, `telefono` y `direccion`. Correo y contraseña usan `/users/me/email-change/{request,resend,confirm}` y `/users/me/password-change/{request,resend,confirm}`. La solicitud exige contraseña actual; el correo nuevo recibe un OTP de ocho dígitos para cambio de correo, y el correo vigente lo recibe para cambio de contraseña. El backend aplica 60 segundos entre envíos, expiración e intentos limitados. Tras confirmar, revoca todas las sesiones. El móvil limpia su sesión y vuelve a login. Las rutas privadas esperan la restauración y conservan solo destinos internos permitidos.

## Compatibilidad web y CSRF

La web conserva `/auth/login`, `/auth/refresh`, `/auth/logout` y cookies HTTP-only `cemydi_access`/`cemydi_refresh`; no recibe tokens en JSON. CSRF sigue requiriendo double-submit para mutaciones basadas en cookies. Solo un request Bearer sin cookies access/refresh queda exento de CSRF; sus guards JWT y de rol siguen obligatorios. Requests mixtos conservan CSRF porque la estrategia JWT prioriza cookie.

El backend actual exige usuario activo y correo verificado. Roles y permisos permanecen definidos en backend; el panel administrativo no forma parte de la app.

## Pendientes explícitos

Google móvil quedó pendiente por decisión del usuario. `/auth/google` y su callback son exclusivamente web; no se abren para fingir una sesión nativa. También siguen pendientes app/universal links para tokens de correo; el recorrido móvil implementado usa códigos reales de ocho dígitos.

El scheme personalizado `cemydi://` no transporta tokens ni secretos: solo abre rutas internas cuya lectura sigue protegida por el servidor. Por eso un hipotético registro ajeno del scheme no expone sesión ni datos. Antes de mover cualquier token a un enlace serán obligatorios app/universal links con verificación de dominio (App Links/Associated Domains); no se añaden esquemas alternativos para sortear esa verificación.

No se considera validado el recorrido real de correo ni la persistencia nativa solo por pasar Jest o exportar bundles. Validar con backend actualizado y correo de pruebas: registro, OTP/reenvío, login persistente/no persistente, reinicio, refresh, revocación, recuperación, logout, offline y foreground en Android e iOS. Ver `TESTING.md`.
