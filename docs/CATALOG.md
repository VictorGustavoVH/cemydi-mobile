# Catálogo público conectado

## Comportamiento vigente

- `/inicio` consulta seis productos con `GET /products?page=1&pageSize=6`. «Ver más», banner, búsqueda y categorías llevan a `/catalogo`; los filtros consultan el catálogo completo.
- Banner y las cuatro categorías editoriales originales de Inicio se muestran desde el primer render, con sus imágenes locales, aunque la API tarde, falle o no haya conexión. Las categorías conservan sus nombres e imágenes y navegan con clasificación estructurada: Movilidad → Movilidad, Descanso → Cuidado en cama, Soportes → Soporte y Apoyo → Apoyo para caminar. El mapeo está en `home-category-filters.ts`; no se inventan clasificaciones ni se convierten las etiquetas editoriales en nombres del backend.
- `/catalogo` muestra compra y renta sin banners. Solicita 10 productos por página y usa una paginación compacta de una sola fila (primera, anterior, página actual, siguiente y última); el salto a una página concreta se abre en una hoja para que el teclado no tape el campo. Mientras llega la página nueva se conserva la anterior, los controles se bloquean y la lista vuelve al inicio al confirmarse la página. Los cambios de búsqueda, filtros u orden vuelven a la primera página. No inicia consultas simultáneas ni navega sin conexión.
- La búsqueda espera 350 ms de inactividad o se confirma con el teclado. Búsqueda/filtros/orden vuelven a la primera página. Cada selección del panel actualiza el catálogo inmediatamente y se conserva al cerrar. «Aplicar filtros» permanece fijo arriba, debajo del título y fuera del scroll de opciones; cierra el panel para ver los resultados ya filtrados. Durante una consulta nueva se retiran las opciones anteriores y se muestra un mensaje de carga hasta recibir las clasificaciones y marcas de esa selección.
- En catálogo, el input ocupa toda la fila. Debajo aparece el botón «Filtros» a la izquierda y, en la misma línea, un carrusel de accesos: Todos, Compra, Renta, Disponibles y Menor precio. Compra/Renta incluyen MIXTO; disponibilidad y orden se combinan con búsqueda y otros filtros. Todos limpia los filtros conservando el texto buscado. Se retiró el contador de productos. Cabecera/buscador/fila de filtros siguen desplazándose con la lista; solo la acción del panel permanece fija. Home conserva su buscador y filtros actuales.
- El buscador compartido conserva borrar, filtros, historial de sesión, sugerencias con fotos/precios y selección directa. Cabecera y buscador se desplazan con la lista tanto en Home como en catálogo; no son sticky. Las sugerencias aparecen flotando debajo del input mediante AppScreenPopover, alojado fuera de la lista por AppScreen, con scroll propio y sin Modal, AppSheet ni sección adicional. No empujan el contenido. Se miden el input y la pantalla para posicionarlas y limitar su altura al espacio disponible sobre el teclado. Home/catálogo mantienen su scroll al abrirlas; se pausa durante el toque, arrastre e inercia de las sugerencias y se libera cuando terminan todas esas fases o se cierra el desplegable. Arrastrar la lista principal cierra las sugerencias. Los recientes envían directamente el término seleccionado. Referencias: [medición de vistas](https://reactnative.dev/docs/0.86/the-new-architecture/layout-measurements), [límites táctiles de View](https://reactnative.dev/docs/0.86/view#hitslop).
- El micrófono usa `expo-speech-recognition@57.1.1`, instalado con Expo CLI y configurado mediante plugin CNG con permisos en español y visibilidad de servicios Android (`androidSpeechServicePackages` para `com.google.android.googlequicksearchbox`, `com.google.android.tts` y `com.samsung.android.bixby.agent`). Dicta en `es-MX`, permite detenerse, actualiza texto editable y no persiste audio. Permisos denegados, servicio ausente y errores conservan la búsqueda escrita. Cerrar, escribir, filtrar, seleccionar, pasar a segundo plano durante dictado activo o desmontar cancela la sesión; los diálogos de permisos del sistema no cancelan la solicitud en curso.
- El micrófono ocupa el trailingAction de AppInput cuando el texto está vacío; al escribir se sustituye por la X. Durante dictado conserva el control para detenerlo. Por petición del usuario no muestra avisos de desarrollo si el módulo nativo aún no está disponible; la prueba de voz se hará en una versión instalada. Android/iOS dependen del servicio de reconocimiento del dispositivo y pueden necesitar red. Referencia: [documentación del módulo](https://github.com/jamsch/expo-speech-recognition#installation). No se cambia la API del backend ni se envía audio a CEMYDI.
- Clasificaciones/marcas provienen de `response.filters`. Modalidad, receta, disponibilidad y los siete órdenes reflejan parámetros confirmados. Los accesos rápidos Compra/Renta de Home incluyen `MIXTO`; el panel permite seleccionar los tres tipos exactos.
- Tarjetas con imagen contenida en espacio 3:2, con altura máxima de 160 y título de dos líneas. Inicio, catálogo y recomendaciones reciben el resumen real de reseñas desde `useProductRatings`, con caché compartida con el detalle y estados de carga/error/offline. La última fila incompleta conserva su ancho. Anchos menores de 350 o fuente superior a 1.3 usan una columna; el texto escala con el sistema.
- Sin stock: superficie/textos grises, imagen atenuada y «No disponible», con detalle consultable.

## Contratos y capas

Verificados en `cemydi-backend/src/modules/products/{products.controller.ts,products.service.ts,dto/find-products-query.dto.ts}`, `prisma/schema.prisma` y `modules/promotions/{promotions.controller.ts,promotions.service.ts}`. Paginación/orden contrastados con `cemydi-frontend/src/app/catalogo/utils/catalog-params.ts`.

`src/services/products` centraliza servicio, schemas Zod y adapters compartidos por Home, catálogo y detalle. Consume exclusivamente el `httpClient` y `EXPO_PUBLIC_API_URL`, sin añadir `/api`, credenciales ni `includeInactive`. Propaga AbortSignal y errores. Una respuesta inválida nunca se sustituye por fixtures.

Desde el 8 de noviembre de 2026, `read()` solicita `cache: 'no-store'` en listado,
detalle, promociones, recomendaciones y reseñas. Se propaga hasta `fetch` con
`credentials: 'omit'`; no cambia la caché de TanStack Query ni sus 30 segundos de
frescura. La comprobación nativa de la política HTTP sigue siendo independiente
de las pruebas del transporte JavaScript.

Detalle comprueba `query.data.product.activo` antes de mostrar la ficha. Una
respuesta 200 con `activo: false`, incluso en caché o antes de resolver ofertas,
presenta «Producto no disponible» sin acciones de compra/renta ni compartir.
Un 404 de revalidación también retira la ficha anterior; el dato activo guardado
en memoria no puede ocultar ese 404. Stock cero conserva su estado de agotado.
El backend local ya filtra productos inactivos en la consulta pública y devuelve
404; esta comprobación móvil es defensiva y no sustituye la autorización del servidor.

Endpoints: `GET /products`, `GET /products/:id`, `GET /products/:id/recommendations?limit=5`, `GET /reviews/product/:id` y `GET /promotions`. Las ofertas se consultan separadamente: un fallo conserva productos, identifica precios base y ofrece reintento. El precio especial es `discountedPrice` del servidor, sin recalcular. Entre ofertas activas del producto se presenta la de menor importe. No se aplica el descuento a `rentalDailyPrice`, porque el contrato solo descuenta `precio`. Se excluyen ofertas vencidas y agotados.

Queries con caché de 30 segundos y políticas compartidas de foco/reconexión/retry. Sin red se pausa la carga y se conservan datos cargados en memoria; no hay persistencia offline.

Home filtra `activo === true` antes de aplicar el límite de seis y antes de
adaptar o exponer `rawProducts`. `seedProductDetail` rechaza además productos
inactivos desde cualquier fuente, sin renovar la fecha de un detalle anterior con
ellos. Favoritos aplica también el filtro de activos al exponer/sembrar productos;
no elimina favoritos almacenados en el servidor como parte de este filtrado.

La revisión del 8 de noviembre de 2026 confirmó en la API las clasificaciones
usadas por las cuatro categorías. El usuario pidió aplicar el mapeo recomendado
conservando imágenes, nombres y contenido estático. Banners permanece editorial y
su destino continúa fijo en `/catalogo`. El riesgo de enlaces arbitrarios en
banners dinámicos es preventivo: no se añade una API de banners ni campos de URL.

Las regresiones comprueban el filtrado antes del límite de seis, que un dato
inactivo no se siembre ni renueve un detalle anterior, que las cuatro categorías
sigan visibles y envíen `clasificacion`, y que el contenido editorial conserve sus
referencias/imágenes aun sin productos activos. La API devolvió las cuatro
clasificaciones del mapeo; una consulta individual con `clasificaciones=Movilidad`
respondió HTTP 200 con un producto de esa clasificación. Se conserva también el
timeout observado en la comprobación adicional de filtros; no se le atribuye una
causa sin evidencia. La validación final de Home/Favoritos aprobó 107 suites y 665
pruebas, además de lint, TypeScript y formato; evidencia en
`test-results/security/home-favorites-final-jest.json` y `.log`. El recorrido nativo
en Android sigue pendiente y no se sustituye por esas comprobaciones.

### Compartir productos

El usuario eligió compartir enlaces HTTPS a la web y confirmó el origen público
`https://ortopedia-cemydi.netlify.app`. `productShareUrl` construye únicamente
`/producto/{slug}` sobre ese origen exacto, con el `slug` ya contratado en la
respuesta del backend. No toma URLs, dominios, redirecciones ni parámetros desde
los datos del producto. Rechaza slugs ajenos al formato canónico del backend,
incluidas URLs, rutas relativas y separadores codificados. Un slug recibido pero
inválido deshabilita compartir con una indicación accesible.

`Share.share` incluye el enlace en `message` para Android, junto con nombre/marca
y modalidad. Los fixtures de pruebas sin slug conservan solo texto; las rutas
conectadas suministran el slug de la API. No se cambia `EXPO_PUBLIC_WEBSITE_URL`,
que se usa en otros flujos. Un cambio de dominio requiere actualizar este origen
aprobado y sus pruebas; no se autorizan otros hosts de Netlify por coincidencia de sufijo.

Esta es la opción de enlace web. No se añadieron filtros nativos ni
`assetlinks.json`; abrir automáticamente la app con Android App Links queda para
una decisión posterior. Esa alternativa requiere asociación verificada del
dominio y la firma Android, como describe
[Android App Links](https://developer.android.com/training/app-links/about).

## Carga e imágenes

La consulta inicial usa `ProductGridSkeleton`, compuesto con Skeleton/SkeletonBlock existentes. Home conserva cabecera/búsqueda durante la consulta; refetch conserva contenido. Inicio, catálogo y detalle esperan la primera respuesta de promociones antes de mostrar precios; un fallo permite mostrar el precio base y reintentar. La recarga manual actualiza productos y ofertas con el control compartido, sin activar su indicador por un refetch automático. Detalle usa skeleton de su estructura y las mismas medidas de galería, miniaturas y recomendaciones que el contenido. Home deja sus productos completos en la caché del detalle; catálogo los prepara al abrirlos. La recuperación desde catálogos/recomendaciones en caché conserva la fecha de origen y selecciona el dato más reciente para permitir refrescar stock y precios antiguos.

CatalogImage conserva contain, memory-disk, recyclingKey, transición reducida, fallback y BlurHash opcional. Los recursos locales conservan hashes propios. Inicio y los fixtures de catálogo usan las siete imágenes WebP recuperadas y el logo horizontal WebP, con dimensiones y transparencia conservadas; sus BlurHash se generan únicamente para los recursos activos mediante `scripts/generate-image-placeholders.py`. El registro conserva también los hashes de autenticación y onboarding: 14 recursos activos en total. Autenticación, Inicio y onboarding comparten el logo horizontal WebP; el PNG original no se importa para evitar recursos Android duplicados. Los siete PNG/JPG originales de catálogo permanecen en el repositorio, pero no se importan en el registro ni se empaquetan en el bundle móvil. No se migra el flujo de onboarding en esta rama. ProductImage del backend entrega URL y orden, **no BlurHash**: fotos remotas usan fondo neutro mientras cargan. No se inventó un hash ni se genera durante render. Una foto ausente no se sustituye por una ilustrativa.

Referencia contrastada: [expo-image SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/image/).

## Detalle y conexiones pendientes

Ids numéricos de `/producto/[id]` abren ConnectedProductDetailScreen: consulta validada y composición existente de galería/zoom, modalidades, descripción, características y condiciones de renta. Incluye error/reintento, 404 y conectividad. Reseñas y recomendaciones consumen sus endpoints públicos con estados de carga, vacío, error/reintento y offline independientes. La calificación proviene de `summary.averageRating`; «Ver más» expande las reseñas ya recibidas. Las tarjetas recomendadas reutilizan ProductCard y precios del servidor. El encabezado conserva Atrás y Favorito durante la carga; Compartir se habilita cuando llega el nombre. Para una cuenta autenticada, los ids reales usan el servicio existente de favoritos; los favoritos de invitado conservan el estado de sesión; los fixtures se usan exclusivamente mediante adaptadores de tests.

Los ids históricos de fixtures se suministran explícitamente desde tests y no abren fichas de producción. Por elección del usuario, se recuperan «Ver carrito» y «Añadir al carrito» también para productos reales. Con una cuenta autenticada, el carrito usa los endpoints del backend y sincroniza disponibilidad, promociones, cupón y totales; un invitado conserva un carrito local en memoria con importes estimados. La autenticación usa los tokens aprobados descritos en AUTHENTICATION.md. La creación de solicitudes de renta desde el carrito, el checkout y la carga de recetas siguen fuera de esta rama. Banners y el aviso de notificaciones de Inicio siguen siendo locales.

## Verificación

Paginación compacta — 30 de octubre de 2026: `AppPagination` quedó en una sola fila (primera, anterior, página actual, siguiente y última) y el salto a página se movió a `AppSheet`, con `KeyboardAvoidingView`, para que el teclado no tape el campo. El catálogo conserva la página anterior con `keepPreviousData`, bloquea los controles y muestra un indicador mientras llega la nueva, vuelve al inicio cuando el servidor confirma la página y ofrece recuperación si la página solicitada dejó de existir. Las valoraciones conservan su identidad cuando no cambian para que el memo de las tarjetas siga vigente. Se actualizaron las pruebas de `AppPagination`, catálogo y hooks; lint, typecheck y las suites afectadas pasan. La comprobación visual en dispositivo sigue pendiente.

Fila de filtros y selección inmediata — 10 de octubre de 2026: 22 pruebas aprobadas en las cuatro suites afectadas (catálogo, Home, buscador e integración catálogo/carrito). Se comprueban filtros rápidos combinados con búsqueda, MIXTO en Compra/Renta, reinicio de página, limpieza conservando el texto, cambios al instante y persistencia al cerrar, opciones conservadas durante carga, acción de aplicar fuera del scroll y contador retirado. La lista detrás del panel se oculta a accesibilidad mientras está abierto. Maestro comprueba la presencia de la acción antes y después de desplazar opciones, pendiente de ejecución nativa: ADB no detecta dispositivos. No se cambian contratos ni dependencias.

Validación de esa fila: lint, typecheck, format:check y git diff --check aprobados. La regresión completa aprueba 189 de 192 pruebas en 35 de 36 suites; permanecen los mismos tres fallos anteriores en ProductCard. Las suites de filtros, sugerencias, Home y recorridos de paneles/carrito pasan.

Revisión del scroll del 10 de octubre de 2026: se corrigieron los límites del desplegable y la coordinación de toque, arrastre e inercia. Las pruebas con CatalogSearch y las pantallas reales de catálogo/Home comprueban que terminar o cancelar el toque no libera el scroll principal mientras sigue un arrastre o la inercia. Resultado: 16 pruebas aprobadas; una prueba anterior de Home falla por esperar un punto final en la etiqueta «Ver producto». Lint, typecheck, format:check y git diff --check aprobados. El intento nativo se detuvo al instalar el controlador de Maestro; después ADB dejó de detectar el emulador. La comprobación del gesto en Android sigue pendiente.

Corrección posterior de Home: la prueba reconoce la etiqueta vigente «Ver producto» y espera la carga de las tarjetas antes de comprobar el límite de seis. Las tres suites de Home, catálogo y buscador pasan con sus 17 pruebas. No se modificó la etiqueta de las tarjetas ni la presentación de Home.

Separación inicial del scroll de Home: se probó montar HomeHeader y CatalogSearch antes de FlatList; las 17 pruebas afectadas pasaron. Esta composición fue sustituida por petición del usuario, que no quiere cabeceras fijas.

Ajuste vigente de cabeceras desplazables: Home y catálogo incluyen su cabecera y buscador en ListHeaderComponent. AppScreen aloja exclusivamente el desplegable en una capa anclada al input, fuera de ambas listas. Las regresiones comprueban buscadores dentro del scroll, sugerencias fuera de él, aislamiento de arrastre/cancelación/inercia, cierre al arrastrar la pantalla, posición relativa a la cabecera segura, altura disponible sobre el teclado y eliminación de la capa al cerrar. La prueba de integración de Home también reconoce «Ver producto» sin exigir un punto final. ADB no detecta un emulador; comprobación visual nativa pendiente.

Regresión completa del ajuste: 35 suites aprobadas de 36; 187 pruebas aprobadas de 190. Las pruebas de AppScreen, AppScreenPopover, CatalogSearch, Home, catálogo e integración catálogo/carrito pasan. Quedan tres fallos en ProductCard por expectativas de presentación anteriores a los cambios locales de las tarjetas; este ajuste no modifica ProductCard. Lint, typecheck, format:check y git diff --check aprobados.

Ajuste del 10 de octubre de 2026: se restauró el desplegable debajo del buscador y se retiró la variante AppSheet. Micrófono dentro del input vacío, X con texto y sin mensajes sobre el entorno de desarrollo. Se conserva la paginación automática. Las 18 pruebas afectadas pasan; lint, typecheck, format:check y git diff --check aprobados. ADB confirmó emulator-5554 conectado; el primer recorrido Maestro no alcanzó el buscador porque Expo Go mostró ErrorActivity. Tras conectar el puerto de Metro y reiniciar únicamente Expo Go, las capturas mostraron splash y después Home con el micrófono dentro del input. Se interrumpió el segundo intento de Maestro sin resultado. Al intentar escribir, Android mostró un aviso de Expo Go sin respuesta; no se atribuye una causa definitiva. La comprobación visual del desplegable y los gestos sigue pendiente; no se probó voz, por decisión del usuario.

Pruebas: contratos/serialización, límite de Home, paginación automática, error/reintento y eventos repetidos de fin de lista, búsqueda remota, filtros inmediatos/combinables, conservación al cerrar, botón de aplicar fuera del scroll, opciones estables durante carga, ausencia del contador, pausa offline, detalle real/404, ofertas y vencimiento durante la consulta, agotados y fallback.

Maestro: catálogo prueba búsqueda/filtros sin depender de nombres de productos concretos. Los recorridos históricos de detalle/carrito abren directamente su fixture local para no mezclar productos reales con el carrito de muestra. Flujos actualizados, pendientes de ejecución nativa.

En la comprobación inicial la API no respondió. En la revisión posterior, el backend local respondió con 57 productos: listado de seis para Inicio, página de 24 para catálogo, detalle y promociones pasaron los schemas reales. La URL móvil apuntaba a una dirección sin respuesta; se corrigió la configuración local hacia la computadora actual. Cambiar `.env` requiere recargar Expo Go. Esto verifica transporte y contratos desde la computadora; el recorrido visual desde dispositivo sigue pendiente.

Exportación Android/iOS generada en `.tools/catalog-api-export`. La revisión automática bloqueó el comando para abrir el catálogo en el emulador con `blocked by policy`. La comprobación visual nativa, fuentes grandes, TalkBack/VoiceOver y recorrido contra una API accesible siguen pendientes. Las verificaciones históricas de otras pantallas no validan esta entrega.

## Revisión de conexión — 8 de octubre de 2026

Se volvió a comprobar el backend local: responde por la interfaz de red actual y contiene 57 productos. La URL del `.env` móvil apuntaba a una dirección sin respuesta; se actualizó únicamente esa variable local, sin copiar su valor a documentación ni modificar el backend.

Las solicitudes reales desde la computadora pasaron los schemas Zod del móvil: Inicio (6 productos), catálogo (24), segunda página (24), detalle y búsqueda por nombre (1 resultado). Promociones respondió correctamente con una lista vacía. El catálogo público ya está conectado y no requiere cambios del servidor para estas lecturas.

Metro estaba activo, pero ADB no enumeró dispositivos ni emuladores conectados durante esta revisión. No se confirmó visualmente el catálogo en Android/iOS. Recargar Expo Go para consumir la configuración actual; si mantiene la URL anterior, reiniciar Metro. El teléfono debe compartir una red que permita alcanzar la computadora. Si cambia la red de desarrollo, comprobar de nuevo `EXPO_PUBLIC_API_URL`.

## Recuperación del detalle — 8 de octubre de 2026

Se recuperaron botones de carrito, reseñas, recomendaciones y toast al conectar productos reales. El usuario eligió mantener el carrito local temporal. Las lecturas reales de reseñas/recomendaciones pasaron los schemas móviles en dos productos: 1 y 0 reseñas respectivamente, y 5 recomendaciones por producto. No se modificó el backend ni la estrategia de autenticación. La comprobación visual Android/iOS sigue pendiente por falta de dispositivo conectado.

Validación de la recuperación: lint, typecheck, format:check y git diff --check aprobados; 162 pruebas en 30 suites aprobadas. La regresión comprueba añadir un producto real a compra/renta, conservarlo al abrir carrito, eliminar/deshacer con toast, favoritos, reseñas expandibles, recomendaciones y reintento independiente de reseñas.

Exportación Android/iOS correcta en `.tools/detail-recovery-export`; no sustituye la revisión visual nativa pendiente.

### Escritura de reseñas

El botón Agregar reseña abre `/perfil/resenas/:productId` con autenticación y
retorno tras login. Consulta la opinión propia y permite crearla o editarla;
queda pendiente de moderación. Reutiliza las estrellas y controles existentes.
El contrato, filtros del servidor y límites están en [API_INTEGRATION.md](./API_INTEGRATION.md).

### Límite de fixtures y detalle

`/producto/[id]` solo consulta la API para enteros positivos seguros. Un identificador local,
negativo, cero o inválido presenta «Producto no encontrado», sin abrir una ficha de muestra.
ProductDetailScreen recibe explícitamente producto, reseñas y recomendaciones; no inventa opiniones.
El adaptador de fixtures de detalle vive en `tests/support/PreviewProductDetailScreen.tsx`.
El carrito temporal utiliza el snapshot del producto consultado, sin resolver fixtures por id.

La ruta presenta ese estado vacío directamente, sin montar el detalle, para IDs
inválidos tanto en desarrollo como en producción. El estado incluye regreso al
catálogo; no requiere `__DEV__` para excluir los slugs de muestra.

### Recomendaciones e imágenes — 8 de noviembre de 2026

Las recomendaciones se filtran por `activo === true` antes de adaptarse a tarjetas,
también al recibir actualizaciones de caché. Una lista compuesta solo por productos
inactivos queda vacía. La autorización y disponibilidad definitivas siguen en el
backend.

El schema de productos exige URLs absolutas HTTP/HTTPS sin credenciales tanto en
la imagen principal como en la galería. Rechaza rutas relativas, esquemas locales,
`data:`, `javascript:` y FTP; conserva `null` para la imagen principal y la galería
vacía. Se admite HTTP para compatibilidad con el contrato existente y desarrollo;
la política Android Release sigue bloqueando tráfico HTTP. La respuesta con una
imagen no válida se trata como error de contrato del catálogo, sin intentar cargar
ese recurso. Este cambio no modifica las imágenes locales editoriales de Inicio.

Validación: 109 suites/693 pruebas aprobadas, lint, TypeScript, formato y
`git diff --check` aprobados. Se cubren recomendaciones desactivadas al actualizar
la caché, URLs inválidas en ambas ubicaciones, rechazo en el servicio HTTP y
slugs de muestra en producción sin montar detalles. Evidencia:
`test-results/security/product-boundaries-jest.json` y `.log`. No se realizó una
comprobación visual en Android físico en esta revisión.

Los productos ilustrativos se separan del contenido editorial en `src/data/catalog-fixtures.ts`.
Solo los importan el servicio mock y los fixtures de detalle, usados por las pruebas;
Inicio conserva banners y categorías sin importar esos productos. Los imports de
ProductDetailPreview en producción son exclusivamente de tipo y se eliminan del bundle.

## Validación de seguridad y compartir — 8 de noviembre de 2026

Lint, TypeScript, formato y `git diff --check` aprobados. La suite completa aprobó
104 suites y 642 pruebas. Se cubren cuentas invitadas en detalle, producto inactivo
en ambos modos, caché inactiva antes de cargar ofertas, desactivación/404 después
de mostrar la ficha, propagación de `no-store` hasta `fetch`, enlace compartido y
rechazo de URLs ajenas como slug. Evidencia:
`test-results/security/products-remediation-jest.json` y `.log`. Se conservaron
los avisos de `act` observados en catálogo y favoritos; no hubo fallos.

La raíz de la web y la ficha pública de muestra
`https://ortopedia-cemydi.netlify.app/producto/silla-de-ruedas-tipo-cama`
respondieron HTTP 200 sin redirección en esta comprobación. Esto acredita
alcanzabilidad HTTP, no el recorrido completo del receptor ni su presentación.
Falta comprobar Compartir desde Android, abrir el enlace en el navegador y el
estado de producto retirado con una build actualizada. La asociación automática
con la app no forma parte de la opción de enlace web elegida.

## Reseñas públicas por páginas — 8 de noviembre de 2026

El backend y el móvil incorporan paginación opcional con autorización del usuario.
Android consulta diez reseñas por petición y carga más solo al pulsar; conserva
«Ver más/Ver menos» para desplegar las opiniones ya descargadas. El total y
promedio se toman del resumen global de todas las aprobadas. Errores al cargar
más conservan las páginas previas, con reintento y bloqueo offline/doble pulsación.
No se modifican imágenes ni contenido editorial de Inicio.

La web conserva su contrato sin parámetros. Los metadatos paginados son
obligatorios para el nuevo servicio móvil: desplegar primero el backend. Contrato,
keys y límites en [API_INTEGRATION.md](./API_INTEGRATION.md).

Validación de paginación: 110 suites/714 pruebas móviles aprobadas; lint,
TypeScript, formato y `git diff --check` aprobados. Evidencia:
`test-results/security/review-pagination-jest.json` y `.log`. Backend: 76 pruebas
de reseñas, build Nest, ESLint/Prettier del módulo y prueba PostgreSQL local
aprobados. La prueba SQL revierte sus fixtures. Se cubren compatibilidad legacy,
resumen global, entradas inválidas, orden estable, repetición rápida, error con
reintento de la misma página, estado offline, cambio de producto y cachés separadas.
ADB no detectó dispositivo: queda revisión visual en Android físico. No hubo
despliegue, push Git ni escrituras de prueba en cuentas reales.
