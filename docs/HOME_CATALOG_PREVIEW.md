# Inicio y catálogo visual

## Estado vigente

Home consulta seis productos reales y sus acciones abren `/catalogo`, que acumula páginas de 24 con búsqueda/filtros remotos. Las tarjetas, ofertas, stock, estados y conexiones pendientes se documentan en [CATALOG.md](./CATALOG.md). Las secciones siguientes describen la vista local histórica y sus verificaciones anteriores.

## Alcance histórico

`/inicio` implementa la segunda propuesta visual aprobada: fondo blanco, marca `#258e8b`, banner con acción **Explorar catálogo**, categorías deslizables y tarjetas en dos columnas. Compra y renta tienen el mismo peso. Con fuente grande o ancho menor a 350 puntos, los productos pasan a una columna. Las tarjetas ahora abren `/producto/[id]`; Carrito abre `/carrito`. Consulta `PRODUCT_DETAIL_PREVIEW.md` para el alcance del detalle y el carrito de muestra.

Todo el contenido es local e ilustrativo. No hay peticiones de productos, autenticación, inventario, precios calculados, checkout ni persistencia. Los tipos de `src/data/catalog-preview.ts` son modelos de presentación, no DTOs. El aviso al pie y las vistas de producto identifican el contenido como muestra. Las imágenes están incluidas en el bundle y funcionan sin red; un fallo de imagen muestra un fallback. No se simulan esperas ni errores de servidor donde no hay operaciones remotas.

## Componentes

- `HomeScreen`: composición, búsqueda/filtros locales y apertura de vistas de muestra.
- `HomeHeader`, `CatalogSearch`, `AppBottomBar`: encabezado, búsqueda y acciones inferiores.
- `BannerCarousel` y `useBannerPlayback`: paginación horizontal, avance cada seis segundos, indicadores y pausa. Se detiene al interactuar, abrir una vista superpuesta, buscar, salir de la pantalla o pasar a segundo plano. Con movimiento reducido o lector de pantalla no hay reproducción automática.
- `CategoryCarousel`: lista horizontal; pulsar una categoría filtra, pulsarla de nuevo elimina la selección.
- `CatalogModeFilter`: Todo, Compra y Renta.
- `ProductCard`, `CatalogImage`, `AppSheet`: tarjeta, imagen con fallback y vista modal accesible.

Reutiliza `AppScreen`, `AppButton` y `AppInput`. `AppButton` admite contenido compuesto, variante `unstyled` para tarjetas y botones con solo icono sin perder su etiqueta accesible. `AppInput` permite un icono inicial y ocultar la etiqueta visual manteniendo el nombre accesible. Los iconos se importan individualmente desde Lucide y usan tokens semánticos.

**Explorar catálogo** y **Explorar** desplazan a los productos de Inicio; no crean una nueva ruta. Perfil y Notificaciones presentan mensajes de muestra. Carrito muestra los items locales añadidos desde Detalle, sin checkout ni solicitudes reales.

## Imágenes mock

Generadas con la herramienta integrada `imagegen`, con transparencia, para esta vista:

- `assets/images/catalog/wheelchair.png`
- `assets/images/catalog/hospital-bed.png`
- `assets/images/catalog/knee-brace.png`
- `assets/images/catalog/walker.png`

Prompt utilizado para cada imagen, sustituyendo `{subject}`:

```text
Use case: product-mockup. Create a single realistic studio product photograph of {subject}. Full object visible, centered, three-quarter view, isolated on genuinely transparent background. Compact square composition, generous 10 percent margin, premium medical equipment catalog image, soft even studio lighting, no text, no labels, no logos, no people, no frame, no ground plane. This is a mock asset for CEMYDI mobile shopping app.
```

Subjects: `a manual orthopedic wheelchair, black padded seat, silver metal frame, small tasteful teal frame accents`; `an adjustable medical hospital bed with white mattress, white safety rails, silver frame, subtle teal accents`; `a black orthopedic knee brace with circular patella opening and adjustable straps, upright`; `a silver aluminum walking frame for adults, four legs, black hand grips and rubber feet`.

## Comprobación manual

1. Abrir `/inicio`; comprobar safe areas y barra inferior fija.
2. Esperar seis segundos, deslizar el banner, elegir un indicador, pausar/reanudar y comprobar el retorno desde segundo plano.
3. Deslizar categorías hasta Apoyo, seleccionar una y volver a pulsarla para quitar el filtro.
4. Probar Compra y Renta; buscar `silla`, una cadena sin coincidencias y limpiar filtros.
5. Abrir/cerrar filtros y un producto, incluyendo el botón Atrás de Android.
6. Activar fuente grande y movimiento reducido; comprobar lectura, scroll y ausencia de avance automático.
7. Probar sin red: imágenes y datos mock permanecen disponibles.

Jest y Testing Library cubren catálogo, query local, recuperación, caché y operación offline. Validación estática: `npm run lint`, `npm run typecheck`, `npm run format:check`. La comprobación visual de iOS requiere dispositivo o simulador macOS.

### Evidencia de esta implementación

En Expo Go sobre el emulador Android se comprobó el render de Inicio, desplazamiento horizontal de categorías, filtro Apoyo (una andadera), filtro Renta (tres productos), búsqueda sin resultados y limpieza, ficha de producto y cierre con Atrás, selección manual del segundo banner y avance automático al tercero. Con fuente 1.5 el banner se organiza verticalmente y las tarjetas pasan a una columna; al activar movimiento reducido desaparece el control de reproducción automática. Los ajustes del emulador se restauraron después de la comprobación.

Se generó el bundle iOS mediante `npx expo export --platform ios`; esto valida resolución y empaquetado, no sustituye la prueba visual en iOS. Quedan pendientes VoiceOver/TalkBack, prueba sin red en un build independiente de Metro y comprobación en dispositivo iOS.

useHome conserva los fixtures en TanStack Query sin depender de red. La cabecera, el buscador y la navegación aparecen de inmediato; LoadingState cubre la consulta inicial y las secciones reales entran suavemente cuando los datos están disponibles, sin Skeleton ni temporizadores de carga simulada. Las fotos locales usan BlurHash precalculado por recurso y transición de 150 ms; movimiento reducido elimina las transiciones. Volver a montar el catálogo reutiliza la caché. Los reexports de Home se eliminaron: la UI transversal y los datos compartidos se importan directamente. Véanse ARCHITECTURE.md y DESIGN_SYSTEM.md para las políticas que deberán revisarse al integrar API.
