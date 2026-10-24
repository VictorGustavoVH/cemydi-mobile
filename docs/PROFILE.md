# Perfil del cliente

## Secciones y revisión — 17 de octubre de 2026

Se agregan Mis rentas (historial paginado de ocho solicitudes, detalle, importes del servidor, entrega, receta asociada y seguimiento), Mis reseñas (lectura y acceso al producto), Ayuda y contacto, Política de privacidad y Términos y condiciones. Se reutiliza Favoritos y se conserva la edición de datos/contraseña existente. No se implementan compra, pago, membresías, solicitudes nuevas de renta ni carga de recetas dentro del perfil.

Los encabezados de Perfil y sus subpantallas son blancos, lisos, sin bordes, sombras ni línea divisoria, con padding y tipografía similares al Catálogo. Las filas del menú y sus contenedores tampoco tienen separadores/bordes. Favoritos adopta el mismo encabezado plano. El Stack raíz desactiva el encabezado nativo por defecto para que una ruta nueva no añada un segundo header. Los controles de formulario conservan sus bordes y estados accesibles.

### Contraste con backend y web

| Sección            | Fuente comprobada                                                                                      | Integración móvil                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Datos y contraseña | UsersController, UpdateProfileDto, UsersService y services/users de la web                             | GET/PATCH existentes, Zod, campos modificados, sesión y borradores                                            |
| Favoritos          | FavoritesController y favoriteService móvil existente                                                  | Se reutiliza `/favoritos`; no se crea otro store                                                              |
| Rentas             | RentalsController, ListMyRentalsQueryDto, listMine/getMine/cancelMine/mapRental y services/rentals web | GET `/rentals/mine?page=&pageSize=8`, GET `/rentals/mine/:id`, PATCH `/rentals/:id/cancel` sin body           |
| Reseñas            | ReviewsController, ReviewsService.listMine/toClientReview y services/reviews web                       | GET `/reviews/mine`; muestra valoración, comentario y estado real                                             |
| Legales            | LegalDocumentsController y serialize/buildLegalSections, contrastados con services/legal-documents web | GET `/legal-documents/:slug` público; usa las secciones ya construidas por el servidor                        |
| Contacto           | Footer y ContactContent de la web                                                                      | Mismos canales públicos; teléfono/correo seleccionables y apertura explícita de la aplicación del dispositivo |

Rentas exige rol CLIENT según el guard del servidor. Cancelar solo se ofrece para PENDING y requiere confirmación; la comprobación definitiva y la transición de estado son del backend. No hay reintento automático ni actualización optimista. El bloqueo de envío, identidad/versión de sesión y la actualización de caché impiden que una cancelación tardía repueble datos tras logout. Se invalida el historial después de confirmar. Las escrituras no se encolan offline.

`useAccountResource` usa keys `['account', userId, ...recurso]`, AbortSignal, gcTime cero, sin retry y reconsulta por foco. El historial reinicia la paginación al cambiar cuenta. Las nuevas vistas separan carga, vacío, error/reintento y offline, y conservan datos disponibles al fallar una actualización. Historial y detalle ofrecen actualización manual; reseñas usa AppRefreshControl/usePullToRefresh. Recursos públicos legales usan una key pública separada y no envían credenciales. Se comprueba que el id/slug de la respuesta corresponde al recurso solicitado.

Los documentos se presentan como lectura nativa de texto: conserva orden de secciones, párrafos, caracteres y enlaces escritos; no ejecuta HTML, scripts ni carga medios remotos. No se fabrican textos legales locales. El backend puede devolver contenido demostrativo si todavía no hay una publicación configurada; la descripción real permanece visible.

### Observaciones existentes del contrato

La auditoría posterior separó el cambio de correo y contraseña del PATCH de perfil: se exige contraseña actual y OTP de propósito específico. El correo anterior continúa vigente hasta la confirmación; después se revocan todas las sesiones. Los canales de contacto son los publicados como constantes en la web, sin un endpoint de configuración: cualquier cambio debe mantenerse alineado.

La revisión automatizada de estos contratos no equivale a probar cuentas reales ni una aprobación general de seguridad del backend.

## Implementación — 16 de octubre de 2026

`/perfil` presenta la identidad de la cuenta, iniciales y estado real del correo, con accesos agrupados a datos personales, dirección de contacto, contraseña, carrito y catálogo. Se combinan la cabecera clara y las filas de las referencias visuales del usuario con los tokens CEMYDI. El avatar usa iniciales: no existe contrato de foto de perfil. No se muestran membresías, pagos ni pedidos inexistentes.

El acceso desde Inicio y la pestaña Perfil lleva a esta ruta. Un invitado inicia sesión y regresa a `/perfil`; las rutas directas separan sesión en comprobación, error e invitado. Un invitado que llegue a una sección privada (enlace directo, «Atrás» desde el inicio de sesión o sesión vencida) vuelve a Inicio con el aviso «Inicia sesión para continuar» en vez de quedarse en una pantalla intermedia sin salida. La barra marca Perfil como activo y se oculta en formularios. Cerrar sesión requiere confirmación y conserva el comportamiento de revocación existente.

## Contrato confirmado

Se revisaron UsersController, UpdateProfileDto, UsersService.getMe/updateMe/toSafeUser, OptionalSessionJwtAuthGuard y JwtAuthGuard. La auditoría actual modificó el backend y añadió una migración aditiva; no añadió dependencias.

- `GET /users/me`: `{ user }`; puede devolver null sin sesión. El móvil usa Bearer, no-store y AbortSignal. Un null autenticado no se transforma en datos vacíos editables.
- El usuario incluye `id`, `nombre`, `correo`, `telefono` y `direccion` nullable, `activo`, `rol`, `emailVerified` y `emailVerifiedAt`. Se valida con Zod extendiendo el contrato de identidad existente.
- `PATCH /users/me`: campos opcionales `nombre`, `telefono`, `direccion`; devuelve `{ message, user }` completo. Teléfono/dirección vacíos se guardan como null en el servidor. `correo` y `password` se rechazan.
- Correo y contraseña se cambian con `/users/me/{email-change,password-change}/{request,resend,confirm}`. La solicitud comprueba `currentPassword`; la confirmación consume un OTP de ocho dígitos y revoca todas las sesiones.

## Edición y validaciones

`/perfil/editar` usa React Hook Form y Zod: nombre de 2–120 caracteres, teléfono opcional con formato de contacto de 7–15 dígitos y máximo 30 caracteres escritos, dirección opcional de hasta 180. El correo se muestra como lectura y enlaza a `/perfil/cambiar-correo`. El formato telefónico es ayuda de UX; no sustituye la validación del servidor.

Se envían solo campos realmente modificados respecto al inicio de edición, incluyendo vacíos explícitos para borrar datos opcionales. El formulario conserva el borrador si hay error o refetch; los campos no editados no sobrescriben cambios remotos. Tras confirmación se adopta la respuesta completa. El backend no ofrece versiones/ETag para resolver dos escrituras simultáneas sobre el mismo campo.

`/perfil/seguridad` reutiliza PasswordField, PasswordStrength, OtpInput y la política de contraseña de autenticación (10–72 caracteres, mayúscula, número y símbolo), con confirmación coincidente. Solicita primero la contraseña actual y después el OTP enviado al correo vigente. Limpia los campos al confirmar y cierra la sesión; no guarda contraseñas en Query, SecureStore, logs o borradores globales.

Los formularios reutilizan AppScreen para teclado y scroll, AppInput/AppButton y feedback inline accesible. `usePreventRemove` de la API pública `expo-router/react-navigation` instalada protege la salida con cambios pendientes, incluyendo el botón atrás de Android. Guardar bloquea navegación y envíos repetidos; no hay reintentos automáticos de escrituras ni cola offline. iOS desactiva el gesto de salida en estas dos rutas; el botón atrás sigue pasando por la confirmación.

## Datos, caché y sesión

`useProfile` coordina screen → hook/query → profileService → cliente HTTP compartido. Query key `['profile', userId]`, staleTime de 30 segundos, lectura al montar/volver al primer plano, sin retry y gcTime cero. Sin datos hay loading/error/reintento/offline; con datos se conservan y se informa si falla actualizar. Offline desactiva edición/guardado y conserva borradores.

Antes y después de guardar se cancelan lecturas del perfil para que una consulta atrasada desde otra pantalla montada no sobrescriba la respuesta confirmada. Se comprueban identidad y versión real de sesión antes de enviar y antes de actualizar caché/identidad. AuthProvider elimina las consultas privadas al cambiar cuenta o cerrar sesión.

La actualización ordinaria de identidad en authSession no cambia tokens ni la versión de autenticación, para no interrumpir operaciones de carrito. Una revisión separada evita que una revalidación iniciada antes del guardado restaure el nombre anterior. La confirmación de correo o contraseña sí revoca sesiones y elimina la identidad local.

### Acceso invitado — 17 de octubre de 2026

`ProfileLayout` ya no renderiza una pantalla «Inicia sesión para ver esta sección». Si un invitado abre una ruta privada sin sesión, el layout muestra `LoadingState` mientras ejecuta `router.replace('/inicio')` una sola vez y avisa con un toast; el aviso se omite cuando el cierre de sesión explícito ya está navegando. Las secciones públicas (`/perfil/ayuda`, documentos legales) siguen con `publicAccess`, y la comprobación de sesión (`loading`) y el error de restauración con reintento no cambian.

La comprobación real con cuenta, teclado, navegación nativa, fuentes grandes y lectores de pantalla permanece sujeta al dispositivo; ver TESTING.md.
