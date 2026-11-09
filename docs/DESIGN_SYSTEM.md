# Sistema de diseño móvil

## Actualización vigente — 24 de octubre de 2026

Inicio, Catálogo, Carrito y Perfil comparten la barra existente como `tabBar` de
Expo Router. El navegador reserva el espacio y la safe area; AppScreen no añade
un segundo padding para esa barra. Detalles y formularios permanecen fuera del
grupo de pestañas. Véase [MOBILE_QUALITY.md](./MOBILE_QUALITY.md).

Onboarding consume las tres variantes WebP recuperadas, con dimensiones originales
y BlurHash propios. El mapa compartido incluye 14 recursos y se verifica mediante
`python scripts/generate-image-placeholders.py --check`. Los PNG originales se
conservan, sin importarlos adicionalmente desde el mapa de onboarding. El script
de conversión no borra originales ni sobrescribe variantes existentes. La revisión
de calidad visual y presentación nativa sigue siendo obligatoria.

Autenticación, Inicio y onboarding importan únicamente el logo horizontal WebP.
El PNG original se conserva como fuente, sin importarlo en la app ni en el registro
de placeholders: Android asigna el mismo nombre de recurso a ambos formatos y
falla con `Duplicate resources` si se empaquetan juntos.

## Estado actual

NativeWind 4 está conectado a Tailwind CSS 3 mediante Babel y Metro. `tailwind.config.js` declara:

```js
colors: {
  brand: '#258e8b';
}
```

La foundation incluye tokens semánticos mínimos en `src/theme`, su equivalencia para NativeWind y componentes base en `src/components/ui`.

La bienvenida usa fotografías, el logo horizontal de la web, fondo `#FFFFFF` y los tokens compartidos. Sus tres pantallas presentan la marca antes de `/inicio`; no representan todavía una feature de negocio funcional.

La web puede servir como referencia de jerarquía e identidad, no como layout para copiar. En particular, `#134e4c` existe en la web, pero está prohibido en el móvil.

## Principios

- interfaz clínica, clara, sobria y legible;
- mobile-first y compatible con Android/iOS;
- superficies sólidas, sin gradientes decorativos;
- jerarquía obtenida con espacio, tipografía y contraste;
- targets táctiles cómodos y estados visibles;
- componentes pequeños con variantes explícitas;
- accesibilidad y reduced motion desde el primer componente.

## Colores

### Valores obligatorios

- Fondo principal: `#FFFFFF`.
- Marca/secundario: `#258e8b`.
- Color prohibido: `#134e4c`.

### Tokens objetivo

Los nombres semánticos son preferibles a colores de escala usados directamente en pantallas:

```text
background      #FFFFFF
surface         #FFFFFF
surface-muted   gris claro neutro
brand           #258e8b
brand-pressed   variante accesible derivada, nunca #134e4c
text-primary    casi negro
text-secondary  gris con contraste suficiente
border          gris claro
success         verde semántico
warning         ámbar semántico
danger          rojo semántico
info            azul semántico
focus           #258e8b
```

Los valores no obligatorios deben validarse visualmente y por contraste antes de formalizarse. No conviertas colores puntuales de una pantalla en tokens globales.

## Spacing

Usa una escala consistente basada principalmente en múltiplos de 4:

```text
1: 4
2: 8
3: 12
4: 16
5: 20
6: 24
8: 32
10: 40
12: 48
```

- Padding horizontal usual de pantalla: 16–24 según ancho.
- Separa secciones por jerarquía, no con contenedores anidados innecesarios.
- Respeta safe areas y teclado.

## Typography

La tipografía oficial de la aplicación móvil es **Inter** (`@expo-google-fonts/inter`), precargada en el root layout mediante `useFonts` y `expo-splash-screen`. En Tailwind CSS se exponen las utilidades `font-sans`, `font-sans-medium`, `font-sans-semibold` y `font-sans-bold`.

Importar los cuatro pesos desde sus subrutas (400Regular, 500Medium, 600SemiBold y 700Bold), con useFonts de expo-font. El barrel general incluía 14 variantes adicionales: la exportación comprobó 4,844,592 bytes menos de fuentes sin comprimir por plataforma. No cambia tipografía ni pesos; no representa una medición de tamaño APK ni de FPS.

Jerarquía objetivo:

- display/title: títulos de pantalla breves;
- heading: secciones y cards;
- body: contenido principal;
- label: formularios y controles;
- caption: metadata y ayuda.

No uses tamaños demasiado pequeños para información necesaria. Permite escalado de fuente y prueba textos largos en español.

## Radius y sombras

- Usa una escala corta de radius, por ejemplo 8, 12 y 16.
- Reserva formas totalmente redondas para icon buttons, avatares y badges apropiados.
- Prefiere borde sutil a sombras fuertes.
- Las sombras deben probarse en Android e iOS; no dependas solo de propiedades específicas de una plataforma.

## Iconografía

La iconografía del cliente móvil se basa de manera exclusiva en **`lucide-react-native`**:

- Prohibido el uso de caracteres tipográficos o flechas de texto (`→`, `←`, etc.).
- Importación directa obligatoria: importar siempre cada icono desde su ruta específica (ej. `import ArrowRight from 'lucide-react-native/icons/arrow-right'`), nunca desde el barrel general para evitar fallos de resolución en Metro y sobrepeso en el bundle.
- Los iconos no tienen un color fijo: se definen dinámicamente de acuerdo a la situación (superficie, variante del componente contenedor y jerarquía visual), consumiendo los tokens semánticos de `src/theme/colors.ts`.
- Tamaños estándar: 16 (compacto/tags), 20 (botones/listas/inputs) y 24 (navegación/acciones principales).
- `strokeWidth`: estándar en 2.
- Ocultar a lectores de pantalla cuando acompañen a un texto accesible.

## Componentes base objetivo

### Button

Variantes mínimas: primary, secondary, outline, ghost y destructive cuando exista una acción destructiva real.

Estados: default, pressed, focused, disabled y loading. El botón debe conservar su label durante loading cuando ayude a evitar cambios de ancho.

### Input

- label visible;
- placeholder no usado como único label;
- ayuda y error asociados;
- `aria`/accessibility props equivalentes;
- configuración de teclado y autofill adecuada;
- estado disabled y readonly distinguibles.

`AppInput` marca automáticamente con borde de marca un valor no vacío (incluido
un dato precargado). Los espacios no cuentan como contenido. Para campos con
reglas, `valid={true|false}` representa el resultado de su schema y prevalece
sobre el simple llenado; los errores y `aria-invalid` tienen prioridad. La pista
accesible distingue «Campo completado» de «Formato válido». Borrar el contenido
restaura el estado neutro. Un borde de grosor constante evita cambios de tamaño
entre estados. `AppDateInput` aplica el mismo criterio a una fecha válida.

`PasswordField` reutiliza `AppInput` y adapta sus iconos al estado. Los formularios
de registro, recuperación, seguridad, perfil, renta, cupones y paginación usan sus
reglas existentes para indicar formato válido. No confundir formato con aceptación
del servidor. Los datos precargados válidos no exigen editarlos para colorearse.

Los inputs conservan ancho dentro del contenedor (`minWidth: 0`, `width: 100%`,
reducción flexible), sin ensancharse por correos, URLs o palabras largas. Notas y
direcciones multilínea tienen altura predeterminada de 120 puntos, máximo de 160
y desplazamiento interno. Las pantallas pueden definir dimensiones explícitas
cuando estén justificadas. No desactivar el scroll interno para autoexpandir un
formulario sin revisar teclado y fuentes grandes. El OTP `unstyled` conserva
sus dimensiones y estilos particulares. Labels, ayudas y errores pueden envolver
texto; no se recortan para fijar la altura de todo el formulario.

La ayuda de contraseña usa CircleQuestionMark junto al label y visibilidad con
Eye/EyeOff. El medidor de creación combina nivel escrito y segmentos semánticos.

### Card

Una card agrupa contenido relacionado y no debe contener capas redundantes. Si es interactiva, toda el área debe tener semántica y estado pressed.

ProductCard comparte el diseño compacto entre Inicio y Catálogo: foto con proporción 3:2 y altura máxima de 160, sin altura mínima del bloque de contenido ni huecos reservados para descuentos ausentes. La etiqueta «Venta», «Renta» o «Venta y renta» deriva de `modes` y también forma parte del nombre accesible, incluso sin stock. Para productos mixtos se indica si el precio visible corresponde a venta o renta. ProductGridSkeleton refleja esta estructura; el contenido conserva escalado de fuente y el nombre ocupa hasta dos líneas.

### Feedback

- Solo el toast con contador de eliminación del carrito usa posición inferior, con 12 puntos de separación sobre la altura medida de GlobalBottomBar (incluye safe area). Sin menú visible respeta el inset inferior. No se desplaza con el scroll; entra desde abajo. Los demás avisos, incluyendo restauración, conservan la posición superior.
- loading: skeleton o indicador proporcional al tiempo esperado;
- empty: explicación y siguiente acción útil;
- error: mensaje claro y retry cuando sea seguro;
- success: confirmación breve;
- offline: estado persistente sin confundirlo con error del servidor.

## Imágenes de producto

- conserva aspect ratio;
- define placeholder y error state;
- evita cargar resoluciones innecesarias;
- proporciona descripción accesible cuando la imagen aporta información;
- no asumas que `next/image` o su configuración web son reutilizables.

## Accessibility

- targets táctiles de al menos 44 × 44 puntos cuando sea posible;
- contraste conforme a WCAG AA;
- labels accesibles para icon buttons;
- orden de foco predecible;
- no comunicar estado solo mediante color;
- soportar font scaling y screen readers;
- respetar reduced motion;
- anunciar errores y cambios importantes sin producir ruido excesivo.

## Responsive móvil

- prueba teléfonos pequeños, medianos y grandes;
- evita anchos fijos que provoquen clipping;
- usa `useWindowDimensions` solo cuando la composición realmente cambia;
- considera orientación únicamente si producto la aprueba; `app.json` está actualmente en portrait;
- `supportsTablet: true` existe, pero el soporte formal de tablet está pendiente.

## NativeWind

- usa tokens y clases semánticas mantenidas en configuración compartida;
- evita hexadecimales repetidos en pantallas;
- ordena clases con Prettier;
- no construyas nombres de clase Tailwind dinámicamente si el compilador no puede detectarlos;
- usa `style` para valores dinámicos que no encajan en clases estáticas;
- no copies clases DOM o breakpoints desktop de la web.

## Revisión visual mínima

Antes de cerrar una pantalla, revisa Android e iOS, safe area, teclado, scroll, textos largos, loading, empty, error, offline, contraste, font scaling y targets táctiles.

## Imágenes y carga: implementación y reglas

Implementado:

- CatalogImage usa expo-image con memory-disk, recyclingKey derivada del origen, contain y fallback accesible. Cambiar el origen reinicia el fallo anterior.
- Admite blurhash opcional correspondiente a cada imagen remota; HomeProduct.imageBlurhash e imágenes de galería son metadatos de presentación, no campos supuestos del backend. Sin hash muestra fondo neutro. No genera hashes durante render ni asigna uno genérico a los productos.
- Las 14 imágenes locales activas de catálogo, onboarding, autenticación y logo horizontal tienen hashes propios precalculados en src/data/local-image-placeholders.ts. CatalogImage los resuelve automáticamente; comparte también contentFit, dimensiones y fallback con esas pantallas. La transición de 150 ms se desactiva con movimiento reducido. No hay esperas para mostrar el placeholder ni cambios en los archivos originales.
- Regenerar al cambiar recursos con `python scripts/generate-image-placeholders.py` (requiere Pillow); `--check` verifica hashes y SHA-256 contra los archivos actuales. La transparencia se compone sobre blanco solo para generar el hash; el original conserva su alfa.
- Home muestra cabecera, buscador y navegación desde el primer render. Su consulta real de seis productos usa ProductGridSkeleton; banners, categorías y filtros conservan el reveal por opacidad de 180 ms y desfases 0/40/80 ms, respetando movimiento reducido. Refetch conserva contenido y ofrece reintento si falla.
- ProductGridSkeleton reutiliza Skeleton/SkeletonBlock y representa las tarjetas actuales. Catálogo paginado y detalle conectado tienen carga inicial; no superponen Skeleton sobre fotos con datos disponibles.
- Detalle público consume API y admite su galería real; los fixtures del detalle se suministran solo en pruebas y el carrito local usa snapshots de productos consultados. Zoom se monta al abrirlo. Véase [CATALOG.md](./CATALOG.md).

Decisiones para nuevas funcionalidades:

1. Datos pendientes: conservar las partes reales disponibles y usar un indicador proporcional. Usar Skeleton cuando represente fielmente la estructura y aporte claridad, como las tarjetas conectadas de Home/catálogo.
2. Datos disponibles e imagen pendiente: renderizar contenido y CatalogImage con su hash, si existe. Ejemplo: tarjeta con nombre/precio ya disponibles y foto aún decodificando o descargando.
3. Imagen en caché o local: dejar que se muestre sin una etapa de espera forzada.
4. Acción pendiente: usar loading/disabled del botón, como login, verificar OTP o confirmar una operación. No sustituir un formulario completo por Skeleton.

Home usa contenido real → BlurHash durante la decodificación → imagen definitiva, omitiendo etapas innecesarias cuando la imagen ya está lista. No superponer Skeleton y BlurHash en el mismo espacio. No introducir esperas artificiales ni estados globales de red para fixtures.

Mantener PNG cuando sea apropiado; comprimir sin pérdida y eliminar solo metadatos prescindibles, preservando color, transparencia, proporción y nitidez. Adaptar resolución únicamente después de medir tamaño de uso y densidad; el zoom puede necesitar el original. No convertir automáticamente a WebP ni borrar recursos sin comprobar referencias. Las optimizaciones de esta auditoría preservaron dimensiones y RGBA exactos; catálogo/onboarding/auth no mejoraron de peso y se conservaron.

La API pública ya valida URLs/campos mediante schema/adapter y conecta OfflineState/useNetworkStatus. Sigue pendiente que backend entregue tamaños/variantes y BlurHash remotos. Sin hash, CatalogImage muestra fondo neutro; no inventar hashes ni calcularlos durante render.

APIs contrastadas con [expo-image SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/image/) y [networkMode de TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode), además de los tipos de las versiones instaladas.

## Teclado y nuevas pantallas

Catálogo usa una fila de filtros debajo del input: botón «Filtros» a la izquierda y accesos rápidos desplazables horizontalmente en la misma línea, con AppButton y estado seleccionado. Su panel aplica los cambios al elegirlos. AppSheet admite headerContent para alojar «Aplicar filtros» debajo del título, fuera del scroll de opciones; las otras pantallas conservan su contenido habitual. No fijar la cabecera de Home/catálogo como solución al scroll: el desplegable del buscador usa la capa anclada de AppScreen.

AppScreen scroll es el único responsable del ajuste y del desplazamiento al campo enfocado en AuthLayout. Mide la intersección de su viewport con el teclado y añade solo el espacio restante, incluyendo cuando Android ya redimensionó la ventana. No anidar KeyboardAvoidingView u otro ajuste automático de insets sobre este mecanismo sin evidencia nativa. Mantener safe areas, scroll y botones alcanzables; validar Android/iOS y fuentes grandes. Onboarding permite escalado del sistema mediante su scroll, sin maxFontSizeMultiplier arbitrario. Usar AppButton para tarjetas/controles con pressed, rol, etiqueta y disabled; compartir componentes antes de crear duplicados.

## Indicador de carga compartido — 2 de noviembre de 2026

`AppSpinner` sustituye al ActivityIndicator de LoadingState, AppButton y
AppPagination. Usa el icono Lucide LoaderCircle con trazo redondeado y una pista
circular tenue, sin fondos decorativos ni gradientes. La rotación CSS de Reanimated
se ejecuta en el hilo de UI con una vuelta lineal de 900 ms; solo anima transform.
Se pausa en segundo plano y se muestra estático con movimiento reducido. La
suscripción a AppState se retira al ocultarlo o desmontarlo.

Corrección del 3 de noviembre: la pista comparte el radio 9 del viewport 24 de
LoaderCircle instalado, evitando dos anillos desalineados. Un estado inicial
`unknown` no pausa el indicador; solo background, inactive y extension lo pausan.
La rotación lineal de 900 ms y el estado estático con movimiento reducido se conservan.

Admite tamaño, color semántico según la superficie, etiqueta accesible, modo
decorativo y `animating`. Se anuncia como progreso indeterminado; dentro de botones
y paginación es decorativo para conservar una sola etiqueta del control. Los
botones siguen mostrando su texto, con acciones bloqueadas durante el envío.
No sustituye los skeletons que ya representan la estructura de datos pendientes.

## Diálogos y filtros — 2 de noviembre de 2026

`AppSheet` admite `presentation="dialog"` para confirmaciones centradas, con ancho
máximo de 420 puntos, safe areas y contenido desplazable si aumenta la fuente.
Conserva su host de toast dentro del modal. `closeDisabled` bloquea X y Atrás al
confirmar una operación. La presentación predeterminada sigue siendo la hoja.

`CatalogFilterChoice` comparte opciones del panel y filtros rápidos. Las selecciones
activas muestran una X en la esquina superior derecha, con área táctil de 44 puntos
y etiqueta «Quitar filtro …». La acción de quitar es hermana del botón de selección;
no anida controles interactivos. Quitar conserva búsqueda y otros filtros. Los
valores predeterminados Todos, Todas y orden reciente no muestran una X; quitar
receta u orden devuelve ese criterio a su valor predeterminado.

## Accesibilidad de catálogo y controles — 2 de noviembre de 2026

- `src/theme/colors.json` es la fuente de valores de color para TypeScript y Tailwind.
  `brand` conserva #258e8b. Botones primarios y texto de enlaces usan `brandStrong`;
  secundarios usan `textSecondary`. Las combinaciones cubiertas tienen al menos 4.5:1.
- AppInput respeta el escalado del dispositivo; solo aplica un límite si el consumidor
  lo solicita explícitamente. ProductCard no encoge precios ni limita sus líneas.
- La foto de ProductCard y su skeleton usan 3:2 con altura máxima de 160 y mantienen
  `contain` de CatalogImage. Las etiquetas de modalidad y disponibilidad están en flujo
  normal para permitir que crezcan sin superponerse a la foto o recortarse.
- El skeleton omite espacios de descuento por defecto; admite descuento y receta explícitos
  cuando se conocen, y sus líneas crecen con la fuente. La altura final puede variar con
  el contenido real; no se promete eliminar todos los desplazamientos de layout.
- El botón de voz mide 44×44. El cierre del zoom usa inset superior + 8 y el modal respeta
  insets laterales e inferior. Las páginas se calculan con el ancho real de cada carrusel.
- AppButton mantiene el texto durante loading y sustituye los iconos por un solo spinner.
- AccountStatusBadge separa estados de renta/reseña y usa surfaceMuted para la apariencia badge.
- Perfil raíz presenta Atrás con destino a Inicio; no recorre formularios de acceso. Las subpantallas conservan su navegación de retorno.

Estas verificaciones automatizadas no certifican layout nativo, TalkBack ni VoiceOver.
Repetir en Android/iOS con fuente ampliada y safe areas; portrait sigue siendo la orientación
configurada. Las pruebas de dimensiones también cubren cambios de ancho sin habilitar rotación.

## Ajustes de tarjetas e iconos — 3 de noviembre de 2026

La valoración de ProductCard aparece a la derecha en la misma fila de la marca,
en la parte superior del bloque de información, incluyendo carga, vacío, error y offline.
ProductGridSkeleton refleja esa posición. Las etiquetas de modalidad siguen en
flujo normal y los precios conservan escalado del sistema.

La imagen recibe una altura numérica derivada del ancho real (3:2, máximo 160),
con `contain`, sin una capa absoluta ni atenuación del producto agotado. Las
cuadrículas y recomendaciones pasan su ancho ya calculado para evitar medirlo de
nuevo por tarjeta; otros consumidores pueden resolverlo mediante onLayout.

Los nuevos tokens accentViolet, accentOrange, accentRose, accentCyan, accentIndigo
y accentSky distinguen opciones de cuenta. Se mantienen la marca y las superficies
blancas; los tonos pasan contraste AA sobre blanco. El encabezado de Perfil usa
Settings negro mediante iconOnSurface y abre Notificaciones provisionalmente.
La edición de perfil permanece en Datos personales y Completar.
No se cambian los permisos ni el comportamiento de las acciones por su color.

## Menús y ayuda — 3 de noviembre de 2026

Login y registro comparten AuthHeaderMenu mediante AuthLayout.headerAction. EllipsisVertical
abre un desplegable anclado a la derecha con «Verificar cuenta» y «Ayuda», texto negro
semántico menuText e iconos de sus colores actuales. Reutiliza AppScreenPopover; ajusta
el ancho al viewport y permite scroll con fuentes grandes. Superficie blanca con radio de
20 puntos, borde borderSubtle y sombra suave; ancho preferido de 216 puntos, padding
exterior de 3 puntos y filas de al menos 44 puntos con 8 horizontales y 4 verticales.
Icono a la izquierda y texto de peso regular. La entrada usa Reanimated CSS sobre el
hilo UI: opacidad, desplazamiento de -4 a 0 y escala de 0.98 a 1 en 180 ms, curva
(0.23, 1, 0.32, 1), sin rebote. Con movimiento reducido usa solo opacidad durante 80 ms. No duplica opciones en el cuerpo.
Verificar valida el correo actual antes de enviar el desafío existente y enfoca el
campo si falta o es inválido; Ayuda abre la pantalla pública sin exigir sesión.
El desplegable cierra al tocar fuera, pulsar Atrás del sistema, perder el foco de la
pantalla o elegir una opción. Login coloca «¿Olvidaste tu contraseña?» arriba a la
derecha del input mediante AppInput.labelTrailingAction; conserva la ayuda junto al label
y permite salto de línea con fuentes grandes. El enlace usa AppButton unstyled sin
padding ni altura mínima heredados, texto de 14/20 e includeFontPadding desactivado en
Android; amplía el área táctil con hitSlop vertical de 12 puntos. La fila alinea su
contenido al borde inferior y se separa del input por 4 puntos (8 en campos sin acción).

Inicio termina con FrequentlyAskedQuestions, compartido con Ayuda y contacto,
independiente de la consulta de productos. Reutiliza AccountSection como acordeón,
sin cards anidadas. El formulario de cupones conserva sus acciones y cierra con X;
no muestra el botón adicional «Volver al carrito». La revisión de carrito lo conserva.

## Refresco nativo y espaciado de tarjetas — 3 de noviembre de 2026

ProductCard y ProductGridSkeleton separan las badges superiores de la imagen con
8 puntos de padding inferior, iguales a los márgenes superior y laterales.

Inicio, Catálogo, Favoritos, Perfil y Notificaciones conectan AppRefreshControl a
consultas reales. Perfil reutiliza el scroll de AppScreen mediante las props
onRefresh/refreshing/refreshEnabled, sin anidar otro scroll. Inicio y Catálogo refrescan
también valoraciones. El indicador representa solo el gesto o reintento explícito;
no se activa por refetch automático. El gesto se desactiva offline y el indicador
se detiene al perder conexión. usePullToRefresh ignora resultados tardíos tras
deshabilitarse o desmontarse para no cerrar una recarga nueva.
