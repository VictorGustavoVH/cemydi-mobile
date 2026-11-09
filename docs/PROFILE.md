# Perfil del cliente

## Seguridad de entradas, datos personales y legales — 8 de noviembre de 2026

Los tres campos de cambio de contraseña ya tenían `maxLength={72}`. La prueba del
formulario comprueba que ese límite se propaga a los campos nativos en ambas
etapas. Es un límite de entrada de caracteres coherente con el schema actual;
no equivale a garantizar el límite de 72 bytes UTF-8 de bcrypt ni reemplaza las
validaciones del servidor. No se cambió la política de contraseñas.

El usuario confirmó ampliar la protección de capturas Android a Datos personales.
`EditProfileScreen` activa `protectCredentials` en el `AccountLayout` existente,
tanto en lectura como en edición. Los campos esperan la activación nativa, se
ocultan ante un fallo y se libera la protección al salir. Perfil general e Inicio
conservan su alcance anterior. La aceptación de captura, grabación y multitarea en
un Android físico sigue pendiente.

Los accesos de privacidad y términos del menú usan `/perfil/legal/:slug` con los
dos slugs existentes y no abren el navegador. El visor conserva la lectura pública
del backend, texto nativo sin HTML ejecutable y estados loading/error/offline.
Este ajuste de navegación no demuestra que abrir un navegador HTTPS constituyera
por sí mismo una vulnerabilidad de DNS o suplantación.

Validación: 109 suites y 695 pruebas aprobadas; lint, TypeScript, formato y
`git diff --check` aprobados. La integración verifica navegación interna sin
`Linking.openURL`, los tres límites nativos de contraseña y la espera/liberación
de protección en Datos personales con Android simulado. Evidencia:
`test-results/security/profile-privacy-jest.json` y `.log`. ADB no detectó un
dispositivo; la protección efectiva de captura/grabación/multitarea queda pendiente
de aceptación en Android físico.

## Favoritos de invitado y filtro local — 8 de noviembre de 2026

El filtro de Mis favoritos limita la entrada a 100 caracteres tanto con `maxLength`
de `AppInput` como al guardar el texto en estado. Una entrada pegada no llega
completa a la normalización ni al filtro de la lista.

El usuario eligió transferir automáticamente los favoritos de invitado al iniciar
sesión. Una sola instancia de `FavoritesLifecycle` en el Stack raíz procesa los
pendientes del `CatalogPreviewProvider` con una sesión autenticada, app activa y
conectividad. Usa `POST /favorites/:id` confirmado en FavoritesController y
FavoritesService: agrega de forma idempotente sin alternar ni borrar favoritos de
la cuenta. No usa `/favorites/toggle/:id` para transferir.

Cada respuesta debe confirmar el mismo id y `favorited: true` antes de retirar
esa selección del estado invitado. Las peticiones son secuenciales y solo admiten
ids numéricos positivos seguros; los ids de fixtures no se envían ni se borran.
La transferencia comparte el bloqueo de escrituras con `useFavorites`, cancela
lecturas anteriores e invalida las dos consultas de la cuenta al terminar. No
realiza actualizaciones optimistas del listado transferido.

Los fallos de red, 429 o respuestas inciertas detienen el lote, sin reintento
automático continuo. Los pendientes se conservan en memoria y se avisa mediante
el toast existente; se reintentan al recuperar conexión, volver a primer plano o
iniciar otra sesión. Un producto no disponible (404) queda pendiente y no impide
transferir los otros. La memoria de invitado no persiste tras cerrar el proceso;
no se promete recuperar esos pendientes después de una terminación de la app.

La identidad y la versión de sesión se comprueban antes de cada escritura y al
recibir su respuesta. Logout o cambio de cuenta detienen el lote saliente y una
respuesta tardía no elimina pendientes ni invalida caché de otra cuenta. Una
escritura ya enviada podría completarse en el servidor de la sesión saliente;
no se simula su cancelación ni una reversión. Si el usuario confirma después una
decisión manual sobre ese producto desde su cuenta, se descarta la intención de
invitado pendiente para no revertir esa elección en el próximo reintento.

El listado expuesto por `useFavorites` omite productos con `activo: false` y no los
siembra en la caché pública del detalle. Los ids y favoritos del servidor no se
eliminan por este filtro; el backend continúa decidiendo disponibilidad y acceso.

Validación local: lint, TypeScript, formato y `git diff --check` aprobados. La
ejecución final aprobó 107 suites y 665 pruebas. Evidencia:
`test-results/security/home-favorites-final-jest.json` y `.log`. Incluye transferencia
automática al login, conservación de favoritos previos y pendientes, reconexión,
429 sin bucles, respuesta posterior al logout y una elección manual posterior a
una transferencia incierta. Se mantienen avisos de `act` en pruebas de perfil y
favoritos, sin fallos. No se hicieron escrituras de prueba en cuentas reales.
No había Android conectado: queda comprobar este flujo con la build actual,
incluidos pérdida de conexión y cambio de cuenta.

## Escritura de reseñas — 31 de octubre de 2026

El detalle del producto abre el formulario de reseña; un invitado inicia sesión y
conserva el destino permitido `/perfil/resenas/:productId`. Mis reseñas permite
editar una opinión y explorar el catálogo para escribir otra. La pantalla consulta
el nombre del producto y la reseña propia, carga el borrador existente y permite
seleccionar de una a cinco estrellas con objetivos táctiles de 44 puntos. Reutiliza
AppInput, AppButton, ProfileLayout y el control de salida sin guardar, sin tarjetas.

Enviar crea o actualiza una reseña del usuario para ese producto, pendiente de
moderación. No se publica inmediatamente. Errores, desconexión y rechazos conservan
el texto. No hay reintento automático del POST ni escrituras en cola. La comprobación
de contenido reside en el backend; ver [API_INTEGRATION.md](./API_INTEGRATION.md).
Los tests usan fixtures y no envían reseñas reales. La protección de contenido
requiere desplegar los cambios del backend; no se hace push ni despliegue automático.

## Filas, separadores y tarjetas — 31 de octubre de 2026

No hay tarjetas en los listados de rentas y reseñas ni en el detalle de renta.
El historial usa filas separadas por líneas, con estado en línea, hasta dos equipos,
total y acceso explícito «Ver detalle». El detalle completo, incluido el resumen,
usa secciones abiertas con separadores. Mis reseñas
usa texto, estrellas compartidas, estado en línea y producto enlazado, sin miniaturas
ni contenedores redondeados. Equipos, entrega y seguimiento del
detalle se organizan como secciones abiertas con líneas. Contacto, productos de
ofertas y notificaciones siguen el mismo criterio de filas. No se anidan tarjetas.
Se conservan miniaturas de equipos en rentas, estados con iconos semánticos,
acciones y refresco automático. En el detalle, fechas, cantidad y precio se agrupan
junto al equipo; los nombres de archivos de receta y el seguimiento se despliegan
bajo demanda. Los motivos de rechazo permanecen visibles. Los títulos de receta,
importes, depósito, entrega y seguimiento recuperan iconos semánticos; las fechas
usan calendario. Se distingue el importe del equipo del total de la solicitud y
la entrega identifica su modalidad antes de mostrar la dirección.

`RatingStars` comparte exactamente las estrellas existentes de las reseñas del
detalle de producto con Mis reseñas: tamaño 14, relleno y contorno `colors.rating`
para estrellas activas, contorno `colors.disabled` y sin relleno para las demás.
La valoración se anuncia como texto accesible. El menú principal no se modifica.

Revisión parcial en HUAWEI STK-LX3 / Android 10: se comprobaron Mis reseñas
sin tarjetas, las estrellas compartidas, el historial y el detalle de renta
completamente plano, incluido el resumen. No se modificaron datos. iOS, fuente
aumentada y lectores de pantalla siguen pendientes.

## Simplificación de subpantallas — 31 de octubre de 2026

La pantalla principal conserva su composición. Datos personales, cambio de correo,
contraseña, rentas, reseñas, ayuda, legales, ofertas y preferencias usan contenido
más breve, espacios consistentes y los controles existentes. `ProfileSection`
comparte títulos y contenido desplegable sin tarjetas anidadas. Preguntas frecuentes,
desglose de depósito y seguimiento se abren bajo demanda; el contenido legal se
mantiene completo y visible. Contacto y acceso al cambio de correo reutilizan
`ProfileMenuItem`; los canales de contacto conservan texto seleccionable.

Rentas, detalle y reseñas usan `autoRefresh` de `useAccountResource`: cargan al entrar,
revalidan datos disponibles al volver y consultan cada 30 segundos mientras la ruta
tiene foco y hay conexión. TanStack Query pausa el intervalo en segundo plano; no
hay botones de actualización manual. Reseñas conserva el gesto de deslizar. Durante
una cancelación se suspenden las lecturas del detalle y se mantienen los controles
de sesión, confirmación e invalidación existentes. Documentos legales no usan polling.

Se conservan loading, empty, error con reintento y datos previos sin conexión. Los
ajustes se guardan al cambiar cada interruptor y se deshabilitan offline. No cambia
ningún endpoint, contrato ni transporte de autenticación. Las pruebas cubren foco,
red, segundo plano, recursos deshabilitados y apertura/cierre del contenido secundario.
La revisión visual de las demás subpantallas e iOS sigue pendiente; la revisión
parcial de rentas se registra en la sección de tarjetas.

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

`useAccountResource` usa keys `['account', userId, ...recurso]`, AbortSignal, gcTime de cinco minutos, sin retry y reconsulta por foco. AuthProvider elimina estas consultas al cambiar de cuenta. El historial reinicia la paginación al cambiar cuenta y conserva la página anterior mientras llega la siguiente (`keepPreviousData`). Las nuevas vistas separan carga, vacío, error/reintento y offline, y conservan datos disponibles al fallar una actualización. Historial, detalle y reseñas se actualizan automáticamente al volver y cada 30 segundos con la ruta enfocada; reseñas conserva AppRefreshControl/usePullToRefresh como gesto opcional. Recursos públicos legales usan una key pública separada y no envían credenciales. Se comprueba que el id/slug de la respuesta corresponde al recurso solicitado.

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

`useProfile` coordina screen → hook/query → profileService → cliente HTTP compartido. Query key `['profile', userId]`, staleTime de 30 segundos, lectura al montar/volver al primer plano, sin retry y gcTime de cinco minutos. Sin datos hay loading/error/reintento/offline; con datos se conservan y se informa si falla actualizar. El menú principal mantiene sus opciones con la identidad de la sesión mientras el perfil carga o no hay conexión, y muestra el aviso dentro del contenido. Offline desactiva edición/guardado y conserva borradores.

Antes y después de guardar se cancelan lecturas del perfil para que una consulta atrasada desde otra pantalla montada no sobrescriba la respuesta confirmada. Se comprueban identidad y versión real de sesión antes de enviar y antes de actualizar caché/identidad. AuthProvider elimina las consultas privadas al cambiar cuenta o cerrar sesión.

La actualización ordinaria de identidad en authSession no cambia tokens ni la versión de autenticación, para no interrumpir operaciones de carrito. Una revisión separada evita que una revalidación iniciada antes del guardado restaure el nombre anterior. La confirmación de correo o contraseña sí revoca sesiones y elimina la identidad local.

### Acceso invitado — 17 de octubre de 2026

`ProfileLayout` ya no renderiza una pantalla «Inicia sesión para ver esta sección». Si un invitado abre una ruta privada sin sesión, el layout muestra `LoadingState` mientras ejecuta `router.replace('/inicio')` una sola vez y avisa con un toast; el aviso se omite cuando el cierre de sesión explícito ya está navegando. Las secciones públicas (`/perfil/ayuda`, documentos legales) siguen con `publicAccess`, y la comprobación de sesión (`loading`) y el error de restauración con reintento no cambian.

La comprobación real con cuenta, teclado, navegación nativa, fuentes grandes y lectores de pantalla permanece sujeta al dispositivo; ver TESTING.md.

## Menú principal — 2 de noviembre de 2026

Los iconos del menú usan tokens contextuales: información en azul, seguridad en verde,
favoritos en rojo y dirección, avisos y reseñas en ámbar. Se muestran
sin superficies ni recuadros detrás. Dirección de contacto describe la sección;
el domicilio solo se consulta en la edición del perfil. `ProfileMenuItem` conserva
la etiqueta, descripción accesible, estado deshabilitado y objetivo táctil completo.

Cerrar sesión abre un diálogo propio centrado de CEMYDI, reutilizando AppSheet
con `presentation="dialog"`, sin Alert del sistema. Ofrece cancelar, cerrar con X
o confirmar; no cierra la sesión al abrirlo y bloquea confirmación, X y Atrás
mientras se procesa el cierre. Se conserva el manejo existente de revocación remota
fallida/pendiente y el retorno a Inicio.

Jest cubre cancelación/confirmación y ausencia del domicilio en el menú. El spinner
compartido y sus límites de verificación se describen en DESIGN_SYSTEM.md. La
apariencia del panel y la fluidez de la animación requieren revisión Android/iOS.
