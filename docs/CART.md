# Carrito conectado

## Estado vigente — 24 de octubre de 2026

El carrito autenticado consume los endpoints existentes del backend mediante Bearer y el cliente HTTP compartido. No hay cambios de backend ni dependencias nuevas en esta entrega. Se verificaron CartController, DTOs, CartService.mapCart, guard JWT y modelos Prisma.

`CartProvider` mantiene el carrito remoto con TanStack Query; `CatalogPreviewProvider` conserva favoritos y el carrito temporal de invitado. `useCart` ofrece a pantalla, detalle y barra inferior la fuente correspondiente a la sesión comprobada. La barra inferior consume el contador mediante `useCartCount`, un contexto numérico independiente del sondeo, para no re-renderizarse cada 10 s mientras la cantidad no cambie. La ruta `/carrito` sigue siendo delgada. Los nombres históricos Preview de los modelos y componentes describen su origen; los datos autenticados ya son reales.

## Operaciones y contratos

- `GET /cart`: obtiene `{ cart }`. El id del carrito es string o null; el id de cada línea es numérico. Los documentos tienen UUID.
- `POST /cart/items`: `productId`, `quantity`, `mode` (`VENTA`/`RENTA`) y fechas/notas opcionales. Añadir incrementa una línea con el mismo producto, modalidad y fechas. No reintentar automáticamente un POST tras perder respuesta.
- `PATCH /cart/items/:itemId`: `quantity` obligatoria, fechas `YYYY-MM-DD` y notas opcionales. Las fechas y notas se guardan en el servidor; periodo mínimo, stock y disponibilidad se validan allí.
- `DELETE /cart/items/:itemId`: elimina la línea. Deshacer vuelve a agregar producto, cantidad y fechas tras una eliminación confirmada. Se valida que siga siendo la misma sesión. Una receta desvinculada por la eliminación no se recupera al deshacer; las tarjetas con documento lo indican antes de eliminar.
- `POST /cart/coupon` y `DELETE /cart/coupon`: aplican/retiran cupón y actualizan el carrito completo. El formato local coincide con ApplyCouponDto; elegibilidad, vigencia y descuento son del servidor.
- El servicio también contempla `DELETE /cart` y `DELETE /cart/rentals`, con el mismo contrato de respuesta.

Todas las respuestas relevantes se validan con Zod. Los campos opcionales de totales por línea reflejan las ramas condicionales reales de mapCart. No se recurre a fixtures si falla la API.

Las líneas usan su id de servidor, incluso cuando hay varias rentas del mismo equipo para fechas diferentes. El contador incluye todas las unidades guardadas. Los controles respetan `availability.maxQuantity`; las líneas no disponibles muestran `reason`. El servidor conserva la decisión final.

## Resumen y selección

El resumen autenticado muestra exactamente `saleSubtotal`, `rentalSubtotal`, depósitos, descuentos y `total` recibidos. No calcula periodos, promociones, cupones ni importes finales. Las rentas sin configurar muestran que el total está incompleto. Un cupón guardado que ya no es válido muestra su motivo.

La selección local se conserva como ayuda de revisión. El total corresponde explícitamente a **todo** el carrito guardado, porque los endpoints no aceptan selección parcial para cotizar ni solicitar renta. No se distribuye un cupón ni se inventa un total para un subconjunto.

## Invitado y transferencia

El invitado puede explorar y conservar productos, cantidades y borradores solo durante el proceso. Los importes son estimados. Tras iniciar sesión se muestra el carrito de la cuenta y un aviso de productos de invitado pendientes. «Guardar productos de invitado» combina cantidades, conservando lo ya guardado, y retira cada producto temporal únicamente tras confirmación. «Descartar productos de invitado» elimina solo los pendientes locales.

La transferencia consulta primero el carrito y mantiene objetivos absolutos en memoria. Si se pierde la respuesta después de un POST confirmado, el siguiente intento consulta el servidor y reconoce el objetivo cumplido sin incrementar de nuevo. Si detecta una cantidad distinta de la inicial y del objetivo, se detiene en lugar de sobrescribirla. Los productos de muestra no numéricos no se envían al backend. La suma mayor de 25 produce un error explícito, sin reducir cantidades silenciosamente. Stock y fechas continúan sujetos a validación del servidor.

No existe endpoint de merge transaccional, clave de idempotencia o control de versión en el backend. La conciliación cubre el reintento observado en este proceso; no constituye una transacción contra ediciones simultáneas de otros dispositivos entre GET y PATCH. Los pendientes locales no persisten tras reiniciar la app.

## Caché, sesión y conectividad

Query key `['cart', userId]`, staleTime de 30 segundos y consulta cada 10 segundos mientras la app está activa y conectada. Volver al primer plano o recuperar la conexión consulta siempre, incluso si la caché sigue fresca. Se conserva pull-to-refresh mediante `usePullToRefresh`, sin mezclarlo con el sondeo: el indicador solo responde al gesto o al reintento explícito y se deshabilita sin sesión, sin conexión o durante una escritura. `GET /cart` usa `cache: no-store`. La consulta periódica se pausa durante escrituras y en segundo plano; no constituye sincronización por sockets ni una transacción entre dispositivos. Las lecturas no reintentan automáticamente los errores. Las escrituras son confirmadas, sin actualización optimista ni cola offline; un bloqueo inmediato evita solicitudes simultáneas desde los controles. Se cancelan lecturas en vuelo antes de escribir y se sustituye la caché con la respuesta completa.

Para compartir carrito con la web, ambos clientes deben usar el mismo backend y la misma cuenta. La web local utiliza `/api` y lo redirige al `INTERNAL_API_URL` de su configuración privada; ese destino debe coincidir con el `EXPO_PUBLIC_API_URL` móvil. Cambiar el destino no migra carritos entre bases de datos y requiere volver a iniciar sesión en la web. La tarjeta «¿Tienes un cupón?» conserva el diseño anterior con icono y acceso al formulario conectado.

Red, timeout, respuesta inválida o 5xx durante una escritura requieren comprobar el carrito antes de repetir. Se invalida la lectura para obtener el estado actual; «Actualizar carrito» confirma la recuperación y libera la barrera. Offline conserva contenido consultado, indica que está sin actualizar y desactiva escrituras. Sin datos hay estados separados de carga, error con reintento, offline y vacío confirmado.

AuthProvider elimina la caché al salir/cambiar de usuario. Las respuestas tardías y Deshacer verifican identidad y versión real de sesión antes de actualizar o volver a agregar. Un 401 usa la renovación y límite de repetición del transporte existente. Una sesión desconocida o con error no se presenta como carrito autenticado comprobado.

## Alcance pendiente

La revisión no paga, no crea pedidos ni envía solicitudes de renta. Checkout de venta sigue sin contrato de backend. El backend sí tiene `POST /rentals/from-cart`, protegido por rol CLIENT, con datos del solicitante, entrega y aceptaciones legales; no se invoca desde una simple configuración de fechas. Solicitud de renta, carga/descarga de recetas y su revisión constituyen flujos posteriores. Se muestra el documento guardado por otros clientes si existe, sin simular una carga móvil.

El cuarto commit conecta la configuración de renta existente con el carrito, el detalle de productos y el contador de navegación. No incorpora pantallas de contratación, notificaciones, pestañas nuevas ni cambios del backend. Se verificó Expo instalado 57.0.31 y la documentación de Expo Router para SDK 57; se conserva la navegación actual con rutas delgadas.

Ver [TESTING.md](./TESTING.md) para evidencia automática y QA pendiente. La exportación de bundles no valida la persistencia ni la presentación en dispositivos.
