# Historial de formularios móviles de acceso

> **Documento archivado.** Conserva el historial de la etapa local anterior y no describe la app actual. La app usa la API y tokens móviles; ver [AUTHENTICATION.md](../AUTHENTICATION.md). El fixture `auth-preview-service.ts` y sus variables `TEST_AUTH_PREVIEW_*` se eliminaron del repositorio. Los resultados visuales históricos no validan la integración actual.

Flujo temporal autorizado, sin peticiones de autenticación ni decisión de cookies/tokens. El backend sigue pendiente según `AUTHENTICATION.md`. No representa seguridad de producción ni permite acceder a recursos privados del servidor.

## Recorridos

- Bienvenida y Omitir → catálogo público `/inicio`. El último paso ofrece también iniciar sesión.
- `/register` → `/otp` para verificar correo → `/login`.
- `/forgot-password` → `/otp` → `/new-password` → `/login`.
- Perfil y revisión del carrito solicitan login al invitado. Tras entrar se vuelve al destino solicitado y se conservan los productos del carrito. La sesión local permite consultar el perfil.
- Google muestra `Próximamente disponible`; no inicia sesión.
- Login presenta enlaces legales, sin aceptación obligatoria. Registro exige aceptar términos y aviso de privacidad.

## Cuenta y estado temporal

Cuenta de prueba: `cliente@cemydi.test`. Su contraseña se configura mediante `TEST_AUTH_PREVIEW_PASSWORD` y el código de ocho dígitos mediante `TEST_AUTH_PREVIEW_OTP`. Son valores exclusivos de pruebas, nunca credenciales reales. Sin contraseña configurada no se crea la cuenta predeterminada; sin código válido configurado no se verifica OTP. Cada desafío admite hasta cinco intentos; el reenvío habilitado tras el cooldown inicia otro desafío y reinicia el contador. Los campos empiezan vacíos en una sesión nueva. Tras enviar OTP, al volver a corregir correo se conserva el nombre/correo de registro o correo de recuperación en memoria; contraseñas, confirmación, aceptación y código se restablecen al remontar el formulario. Las cuentas registradas, cambios de contraseña y correo recordado viven exclusivamente en la instancia de `AuthPreviewProvider`; reiniciar el proceso restaura los valores iniciales. Recuérdame conserva solo el correo entre pantallas durante esa ejecución, nunca la contraseña ni una sesión persistente.

`auth-preview-service.ts` concentra las operaciones temporales. La cuenta registrada exige verificación antes de entrar; recuperación exige verificar primero, consume el desafío al guardar y rechaza la contraseña anterior. No se inventan endpoints, DTOs ni tokens. Las operaciones locales funcionan sin red y no incorporan esperas artificiales. Los formularios exponen loading para bloquear envíos simultáneos, errores de campo y toasts de resultado.

## Reglas contrastadas

Fuentes locales: web `src/app/{login,register,forgot-password,reset-password,verify-email}/page.tsx` y `src/lib/password-validation.ts`; backend `src/modules/auth/dto/register.dto.ts`, `password-policy.ts`, `password-reset-code.decorators.ts` y `utils/auth-crypto.util.ts`.

- Nombre: 3–100 caracteres, letras Unicode, espacios, apóstrofo y guion como en registro web.
- Correo: obligatorio, formato web, máximo 254; normalización de espacios y mayúsculas al operar.
- Login: contraseña obligatoria, sin imponer requisitos de creación a cuentas existentes.
- Registro y nueva contraseña: 10–72 caracteres, mayúscula ASCII, número y símbolo según política compartida; confirmación idéntica.
- Indicador de cuatro segmentos: rojo para Baja, ámbar para Media y verde para Alta, acompañado de texto. Es una ayuda visual de cumplimiento, no una estimación criptográfica. El componente global PasswordField muestra los requisitos al pulsar el icono de ayuda junto al label y ofrece visibilidad independiente.
- OTP: ocho dígitos. Un único AppInput nativo, cubierto visualmente por las casillas, recibe escritura, pegado y autofill; ocho casillas flexibles reflejan el valor sin duplicar el texto nativo. Filtra separadores antes de limitar a ocho dígitos, indica el foco real y el cursor. Al verificar se bloquean cambios y reenvíos, las casillas transicionan a verde durante 180 ms y se anuncia Código verificado antes de navegar a los 550 ms (300 ms sin movimiento con reduced motion).
- Reenvío: 60 segundos desde solicitud inicial y cada reenvío, medidos por reloj absoluto y actualizados al volver a foreground. El servicio también lo bloquea para evitar saltarse el temporizador de UI. Desafío local de 30 minutos, cancelable y de un solo uso al completar.

## Enlaces legales

Configurar `EXPO_PUBLIC_WEBSITE_URL` en el entorno local con el origen público de la web y reiniciar Metro. `.env.example` deja el valor vacío. Se abren `/terminos-y-condiciones` y `/politicas-de-privacidad` con Linking; URL ausente/inválida o error de apertura muestra toast sin bloquear el arranque. La URL se valida igual que la API: `https` obligatorio en producción y `http` permitido en desarrollo; se rechazan esquemas distintos de http/https y credenciales embebidas. No se copian valores reales de `.env`.

## Componentes y plataformas

Se reutilizan AppScreen, AppInput y AppButton. AppInput incorpora ref, acción en label y estado de formato válido con borde del color principal y pista accesible; los errores tienen prioridad. PasswordField global centraliza ayuda y visibilidad. El modo unstyled se reserva para el overlay nativo del OTP. Los errores de input usan rojo vivo con borde de 2 puntos. AppScreen desplaza el campo activo cuando aparece el teclado o cambia el foco. La ayuda de contraseña usa un Modal transparente anclado al icono, con cierre exterior y límites de pantalla/teclado, sin ocupar espacio en el formulario. Formularios con React Hook Form/Zod, errores en español, scroll y safe areas; AppScreen concentra el ajuste de teclado sin KeyboardAvoidingView adicional. Ilustraciones locales existentes encuadradas mediante sus límites útiles, sin modificar los archivos, y SVG de Google facilitado por el usuario. Los formularios ocupan el ancho disponible con márgenes de 20 puntos, títulos y descripciones centrados a todo el ancho, espacios compactos y avance entre campos desde el teclado. Los enlaces legales forman parte de una misma frase; solo registro requiere checkbox. Documentación de las APIs contrastada con [Expo Router SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/router/), [TextInput](https://reactnative.dev/docs/textinput) y [KeyboardAvoidingView](https://reactnative.dev/docs/keyboardavoidingview).

Pruebas cubren validaciones, credenciales erróneas, registro/verificación, recuperación, pegado, reenvío, expiración, protección de los pasos y correo recordado. Pendiente QA nativa en Android/iOS: pegado desde menú del sistema, autofill real, teclado, fuentes ampliadas, TalkBack/VoiceOver y regreso de background. Jest no valida apariencia ni teclado nativo. No hay dependencias añadidas.

## Evidencia de validación

- Suite completa: 20 suites y 110 pruebas aprobadas. Incluye controles de contraseña, colores, prioridad de errores, OTP y acceso invitado con retorno al carrito.
- TypeScript, ESLint y Prettier verificados al terminar.
- Exportaciones Metro/Hermes Android e iOS correctas. No equivalen a builds nativas instaladas.
- Pixel_7 con Expo Go 57.0.9: login, recuperación y OTP revisados visualmente. Se confirmó escritura de ocho dígitos sin texto duplicado, casilla de foco, confirmación verde y navegación a nueva contraseña. Se corrigieron dos fallos detectados en Android: curva CSS mediante cubicBezier de Reanimated y opacidad del overlay nativo. Capturas locales en `.tools/auth-otp-filled.png` y `.tools/auth-otp-success.png`.
- Pendiente revisión en dispositivo físico y iOS, fuentes ampliadas, lectores de pantalla, autofill y pegado desde menú del sistema. No hay simulador iOS en este host Windows.
- Jest requiere ejecución fuera del sandbox por EPERM al resolver el directorio temporal. No se añadieron dependencias.

## Ajustes de presentación y teclado

- Onboarding reserva el mismo espacio inferior en sus tres pasos para conservar la posición del botón principal; el acceso opcional aparece solo en el último.
- Títulos y descripciones centrados a todo el ancho útil. El formato válido usa marca; el error usa rojo vivo y borde más grueso. La confirmación real de OTP conserva el verde.
- Ayuda de contraseña flotante verificada en Android, sin desplazar los campos.
- Scroll al foco medido dentro de la ventana, con compensación de barra de estado en Android, espacio temporal para el teclado y limpieza de callbacks al desmontar. Captura de confirmar contraseña completamente visible en `.tools/auth-keyboard.png`; tooltip en `.tools/auth-tooltip.png`.
- OTP permite menú nativo y selecciona el texto al recuperar foco. Un código completo pegado reemplaza el anterior incluso desde una posición intermedia; prueba de regresión incluida.
- 110 pruebas aprobadas; verificaciones estáticas y exportaciones Android/iOS correctas. Revisión iOS y dispositivos físicos pendiente.

El campo nativo del OTP conserva su visibilidad para que Android pueda ofrecer el menú de pegado; las casillas opacas y sus espacios cubren su texto en otra capa, sin deshabilitar escritura, selección ni autofill. El pegado real desde el portapapeles se comprobó en Android en `.tools/auth-paste-result.png`.

Mantener pulsada la primera casilla también abrió el menú nativo de portapapeles en Android, con código previamente copiado: `.tools/auth-paste-menu.png`. No se añadió ninguna dependencia.

La auditoría separó el contador visual en OtpResendButton: el formulario no se renderiza por cada segundo, el cálculo usa resendAt absoluto y el servicio sigue verificando el límite. AppScreen reserva solo la intersección real con el teclado. La revisión nativa de estos ajustes debe repetirse: Maestro falló antes de los flujos por Broken pipe del servicio package del emulador, y dumpsys window agotó su timeout. Las capturas históricas anteriores no validan esta revisión.
