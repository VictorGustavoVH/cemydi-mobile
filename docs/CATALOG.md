# Catálogo público conectado

## Comportamiento vigente

- `/inicio` consulta seis productos con `GET /products?page=1&pageSize=6`. «Ver más», banner, búsqueda y categorías llevan a `/catalogo`; los filtros consultan el catálogo completo.
- Banner y las cuatro categorías editoriales originales de Inicio se muestran desde el primer render, con sus imágenes locales, aunque la API tarde, falle o no haya conexión. Las categorías abren una búsqueda por su nombre; los filtros de clasificación reales del catálogo siguen usando opciones del backend.
- `/catalogo` muestra compra y renta sin banners. Solicita 24 por página como la web. «Ver más» acumula páginas según `pagination.hasNext`, deduplica ids y conserva productos ante errores de páginas posteriores. No hay carga automática al alcanzar el final.
- La búsqueda espera 350 ms de inactividad o se confirma con el teclado. Búsqueda/filtros/orden vuelven a la primera página. El panel tiene borrador: cerrar descarta cambios; «Aplicar filtros» los confirma.
- Clasificaciones/marcas provienen de `response.filters`. Modalidad, receta, disponibilidad y los siete órdenes reflejan parámetros confirmados. Los accesos rápidos Compra/Renta de Home incluyen `MIXTO`; el panel permite seleccionar los tres tipos exactos.
- Tarjetas con imagen contenida en espacio 4:3, máximo 200 puntos de altura, título de dos líneas y espacios reservados para precio original/estado. La última fila incompleta conserva su ancho. Anchos menores de 350 o fuente superior a 1.3 usan una columna; el texto escala con el sistema.
- Sin stock: superficie/textos grises, imagen atenuada y «No disponible», con detalle consultable.

## Contratos y capas

Verificados en `cemydi-backend/src/modules/products/{products.controller.ts,products.service.ts,dto/find-products-query.dto.ts}`, `prisma/schema.prisma` y `modules/promotions/{promotions.controller.ts,promotions.service.ts}`. Paginación/orden contrastados con `cemydi-frontend/src/app/catalogo/utils/catalog-params.ts`.

`src/services/products` centraliza servicio, schemas Zod y adapters compartidos por Home, catálogo y detalle. Consume exclusivamente el `httpClient` y `EXPO_PUBLIC_API_URL`, sin añadir `/api`, credenciales ni `includeInactive`. Propaga AbortSignal y errores. Una respuesta inválida nunca se sustituye por fixtures.

Endpoints: `GET /products`, `GET /products/:id`, `GET /products/:id/recommendations?limit=5`, `GET /reviews/product/:id` y `GET /promotions`. Las ofertas se consultan separadamente: un fallo conserva productos, identifica precios base y ofrece reintento. El precio especial es `discountedPrice` del servidor, sin recalcular. Entre ofertas activas del producto se presenta la de menor importe. No se aplica el descuento a `rentalDailyPrice`, porque el contrato solo descuenta `precio`. Se excluyen ofertas vencidas y agotados.

Queries con caché de 30 segundos y políticas compartidas de foco/reconexión/retry. Sin red se pausa la carga y se conservan datos cargados en memoria; no hay persistencia offline.

## Carga e imágenes

La consulta inicial usa `ProductGridSkeleton`, compuesto con Skeleton/SkeletonBlock existentes. Home conserva cabecera/búsqueda durante la consulta; refetch conserva contenido. Detalle usa skeleton de su estructura.

CatalogImage conserva contain, memory-disk, recyclingKey, transición reducida, fallback y BlurHash opcional. Los recursos locales conservan hashes propios. ProductImage del backend entrega URL y orden, **no BlurHash**: fotos remotas usan fondo neutro mientras cargan. No se inventó un hash ni se genera durante render. Una foto ausente no se sustituye por una ilustrativa.

Referencia contrastada: [expo-image SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/image/).

## Detalle y conexiones pendientes

Ids numéricos de `/producto/[id]` abren ConnectedProductDetailScreen: consulta validada y composición existente de galería/zoom, modalidades, descripción, características y condiciones de renta. Incluye error/reintento, 404 y conectividad. Reseñas y recomendaciones consumen sus endpoints públicos con estados de carga, vacío, error/reintento y offline independientes. La calificación proviene de `summary.averageRating`; «Ver más» expande las reseñas ya recibidas. Las tarjetas recomendadas reutilizan ProductCard y precios del servidor. Favoritos siguen siendo de sesión y se anuncian con toast.

Los ids históricos de fixtures conservan su detalle para pruebas. Por elección del usuario, se recuperan «Ver carrito» y «Añadir al carrito» también para productos reales: cada línea conserva un snapshot de presentación durante la sesión, con compra/renta separadas, cantidades, eliminación/deshacer y toast. Agotados no se pueden añadir. El carrito informa que es temporal y que sus importes son estimaciones; no confirma disponibilidad, no envía solicitudes ni llama a la API de carrito. Autenticación y transporte cookies/tokens siguen pendientes. Banners y notificaciones son locales.

## Verificación

Pruebas: contratos/serialización, límite de Home, paginación, error/reintento y toques repetidos en «Ver más», búsqueda remota, filtros confirmables/cancelables, pausa offline, detalle real/404, ofertas y vencimiento durante la consulta, agotados y fallback.

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
