# Carrito de muestra

## Decisiones de diseño

`/carrito` toma la referencia de tarjetas, selección, controles de cantidad, cupón y resumen compartida por el usuario. Usa fondo blanco y marca CEMYDI, con una sola pantalla dividida en Compra y Renta. Ambas secciones comparten un acceso a cupones, un resumen y un botón fijo «Revisar carrito». El resumen distingue el subtotal de compra, las tarifas diarias y los depósitos de renta; no los suma como si fueran un total confirmado.

Decisiones tomadas en la entrevista con el usuario:

- Cada producto se añade seleccionado. Las casillas y «Seleccionar todo» están ocultos inicialmente. Mantener presionada la imagen o el nombre de un producto activa el modo de selección; también existe una acción accesible para lectores de pantalla. En este modo puede desmarcarse un producto sin eliminarlo. «Listo» vuelve a ocultar los controles conservando la selección; el pie indica cuántas unidades se incluyen si difieren del total.
- El contador de navegación suma todas las unidades del carrito, incluso las desmarcadas. Se oculta si el carrito está vacío y muestra `99+` a partir de 100; su etiqueta accesible conserva el número completo.
- Las cantidades se editan entre 1 y 25. Menos se desactiva en 1; la papelera elimina y Deshacer restaura la última eliminación, con modalidad, selección, cantidad y borrador. Añadir desde el detalle respeta el mismo límite.
- Cada equipo de renta abre un panel en el carrito. Inicio, devolución y notas se guardan como borrador durante la sesión. El panel distingue equipos que requieren receta.
- El espacio de cupones abre una explicación de su disponibilidad futura; no inventa descuentos.

Las tarjetas compactas alinean imagen, nombre, precio y cantidad, con controles de al menos 44 puntos. Todos los importes muestran MXN junto al número. Se retira el rótulo «Carrito de muestra» de la pantalla. Tocar imagen o nombre abre la ficha manteniendo la modalidad; en modo de selección alterna su inclusión. Se usa SectionList para virtualizar y se adapta la composición de precio/cantidad en pantallas estrechas o con texto aumentado. El modal compartido contempla teclado, scroll, safe areas y cierre con Atrás.

## Estado local y límites

Se extiende el CatalogPreviewProvider existente. Los datos, imágenes y precios son fixtures explícitos; selección, cantidades y borradores son locales y se pierden al reiniciar la aplicación. No hay requests autenticados, pagos, pedidos, uploads, validación de cupones ni envío de solicitudes. El carrito funciona sin red; no se simulan loading/error/offline de API porque no hay transporte remoto.

La compra muestra un subtotal ilustrativo de las unidades seleccionadas. La renta presenta tarifa diaria y depósitos de referencia por separado, y mantiene el total por confirmar. No calcula duración cobrada, promociones, disponibilidad ni total definitivo. La validación de campos de fecha comprueba formato, fechas existentes y orden; el servidor deberá confirmar fechas, mínimo y disponibilidad antes de solicitar la renta.

Se revisaron AddCartItemDto, UpdateCartItemDto, CartController, resolveRentalWindow y CreateRentalFromCartDto/createFromCart del backend. El límite contractual es 25 por item; stock y disponibilidad los valida el servidor. La renta admite añadir equipos sin fechas. La solicitud actual toma **todas** las rentas del carrito y no recibe identificadores de items seleccionados. Por ello, la selección de este prototipo permite revisar un subconjunto, pero su futura conversión en solicitud necesita un contrato confirmado que admita esa selección. No se simula un envío exitoso.

La autenticación móvil continúa pendiente; esta tarea no decide cookies o tokens. Las recetas solo muestran requisito y formatos confirmados (PDF/JPG/PNG, hasta 8 MB); no se presentan como adjuntas. La compra no tiene checkout confirmado.

## Componentes y pruebas

AppBottomBar y AppSheet reutilizan las implementaciones que estaban en Inicio, promovidas a UI compartida. Las rutas antiguas de componentes reexportan por compatibilidad. AppButton admite el rol accesible de checkbox.

La suite del carrito comprueba cantidades y límite, selección independiente por modalidad, subtotal, contador, eliminación/deshacer, fechas inválidas, conservación del borrador por equipo, revisión de selección, cupón informativo y carrito vacío. Se actualizan las pruebas de Detalle e Inicio para consumir el diseño y provider compartidos.

Validación del ajuste: lint, typecheck y format:check pasan; cuatro suites y 12 pruebas pasan. Persisten las advertencias preexistentes de act en useHome. En Expo Go sobre Android se comprobó el carrito vacío y con ambas modalidades, las tarjetas compactas con MXN, el acceso único a cupones, el botón único de revisión, la activación de selección mediante pulsación larga, su efecto en el resumen y el cierre con Listo. El export iOS se genera correctamente en `.expo/cart-ios`; queda pendiente la prueba visual en un dispositivo iOS y con lectores de pantalla.
