# Detalle de producto

> **Documento archivado.** Las secciones siguientes describen el detalle histórico de fixtures. El estado actual está en [CATALOG.md](../CATALOG.md).

## Estado en el momento del archivo

Los ids numéricos consultan el backend y reutilizan la galería/composición de detalle. Presentan precio, stock, ofertas y condiciones reales, sin carrito, reseñas o recomendaciones de muestra.

## Diseño y navegación históricos

`/producto/[id]` reemplaza la ficha modal de Inicio. La composición toma la segunda referencia del usuario: imagen protagonista con acciones superiores, miniatura, categoría, nombre, valoración, precio y acciones inferiores fijas. Conserva fondo blanco y marca CEMYDI `#258e8b`.

Descripción y Características alternan mediante dos botones. Reseñas y recomendaciones aparecen después del contenido. Las recomendaciones abren otra ficha; Atrás regresa al origen sin acumular recomendaciones en el stack. Hay recuperación para un identificador inexistente y fallback para imágenes fallidas.

Los productos mixtos tienen selector Compra / Renta. Una modalidad única no muestra opciones que el producto no admite. Abrir desde un filtro conserva esa modalidad. Se utilizan las siete imágenes locales existentes; como hay una por producto, se muestra una sola miniatura sin inventar ángulos adicionales.

## Decisión de compra y renta

- Compra: añadir directamente al carrito, sin configuración previa.
- Renta: añadir al carrito y configurar fechas, receta cuando corresponda y solicitud desde allí.
- El detalle presenta tarifa diaria, mínimo, depósito y condiciones para renta.
- No hay botones Comprar ahora ni pagos: el backend aún no tiene checkout de venta.

Se revisaron `Product` en el schema Prisma y `AddCartItemDto` / `resolveRentalWindow` del servicio de carrito. El backend permite añadir renta sin fechas y define tarifa diaria, mínimo y depósito. No se calcula una mensualidad ni un total definitivo en el móvil.

## Límite de esta entrega

Es una vista de muestra compatible con el catálogo local actual. No se conectan endpoints ni se elige transporte de autenticación. Los precios, condiciones, características y reseñas de ejemplo se identifican como ilustrativos. Las reseñas se muestran como ejemplos para cama y silla; otros productos tienen estado vacío. Las recomendaciones se ordenan localmente por categoría, sin presentarlas como recomendaciones personalizadas del servidor.

`CatalogPreviewProvider` conserva favoritos y un carrito local solo durante esta sesión de la aplicación. `/carrito` separa compra y renta, permite seleccionar items, editar cantidades, eliminar/deshacer y guardar fechas/notas de renta como borrador. El contador de navegación suma las unidades. No guarda pedidos, envía solicitudes ni adjunta recetas. Véase [CART_PREVIEW.md](./CART_PREVIEW.md). La conexión real requiere resolver autenticación móvil; la finalización de venta requiere un proceso confirmado.

Compartir usa `Share` de React Native y envía texto de muestra. No inventa una URL pública del producto. El error se anuncia en la pantalla.

## Organización

- `src/data/catalog-preview.ts`: catálogo compartido de presentación, incluyendo las imágenes nuevas de bota, concentrador y muletas.
- `src/data/product-detail-preview.ts`: contenido ilustrativo de detalle.
- `src/components/ui/CatalogImage.tsx` y `ProductCard.tsx`: componentes existentes promovidos para uso en Inicio y Detalle; los consumidores importan directamente UI compartida; ya no hay reexports en Home.
- `src/features/products/ProductDetailScreen.tsx`: composición e interacciones del detalle.
- `src/features/cart/CartPreviewScreen.tsx`: revisión del carrito de muestra.
- Rutas delgadas bajo `src/app`; estado de sesión local en el provider compartido.

El contenido y las imágenes locales funcionan sin red. No se simulan loading o errores de API porque no hay requests remotos. Compartir incluye estado busy/error; los botones base mantienen pressed/disabled. La composición inferior pasa a vertical con fuente grande o pantalla estrecha, y las características también se apilan.

## Validación

Pruebas de componente: separación de modalidades en carrito, eliminación de una modalidad, favoritos al volver a montar la ficha, modalidad inicial, características, receta, reseñas vacías, error al compartir y recuperación de producto inexistente.

Validación requerida: lint, typecheck, format check y Jest. La comprobación de iOS mediante export valida resolución y empaquetado; no reemplaza una prueba visual en dispositivo. VoiceOver/TalkBack y dispositivos iOS quedan pendientes.

Resultado: typecheck, format check y lint sin errores; lint advierte un directive no usado en tipos generados de `.expo`. Las tres suites y siete tests pasan; las pruebas anteriores de Inicio emiten warnings de `act`. Export iOS generado correctamente en `.expo/product-detail-ios`.

En Expo Go sobre Android se comprobó el render del detalle, cambio a renta y tarifa diaria, contenido de condiciones, scroll, acción de favorito, añadir una renta y navegación al carrito con el item y modalidad correctos.

Auditoría correctiva: se eliminó la repetición artificial de cuatro imágenes idénticas. ProductDetailPreview.images admite una galería opcional con id/source/blurhash de presentación; sin ella se usa solo la imagen principal. Miniaturas/carrusel/zoom permanecen; el zoom no monta imágenes mientras está cerrado y se posiciona al medir layout, sin timeout artificial. Recomendaciones y galería se derivan una vez por producto. Compartir tiene bloqueo inmediato contra doble pulsación y estado busy/error.
