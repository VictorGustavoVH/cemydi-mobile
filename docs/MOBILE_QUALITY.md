# Calidad móvil: pestañas, notificaciones y onboarding

Estado: 24 de octubre de 2026. Rama `test/mobile-quality`, basada en
`feature/cart-rentals`. No se añadieron dependencias ni se modificaron contratos
de autenticación, catálogo, carrito o rentas.

## Navegación

`src/app/(tabs)` aloja Inicio, Catálogo, Carrito y Perfil. Las URLs públicas
siguen siendo `/inicio`, `/catalogo`, `/carrito` y `/perfil`. Los detalles,
login y subrutas de Perfil permanecen en el Stack raíz.

Tabs conserva las pantallas visitadas y usa historial de pestañas. La barra
existente se monta como `tabBar`; no se duplica en el layout raíz. El navegador
reserva su espacio y safe area: no se agrega padding absoluto a AppScreen.
El contador sigue consumiendo CartProvider. Perfil mantiene su protección y
el destino de retorno del login; su redirección se evalúa solo con foco.

Las acciones de pestañas usan `navigate`. Inicio envía un marcador `t` cuando
pide una nueva búsqueda, modalidad o filtros; Catálogo aplica esos parámetros
sin remontarse. Volver a la misma pestaña conserva las ediciones locales.
El botón de Inicio mantiene la acción de volver al principio.

## Recursos y recuperación selectiva

Se recuperaron los WebP de onboarding, con las dimensiones de los originales,
y se recalcularon los BlurHash de los 15 recursos incluidos en el mapa compartido.
Las tres fotos pasan de 735208 a 196858 bytes antes de empaquetar. Esto no mide
el tamaño de una APK ni el rendimiento de un dispositivo. Los PNG originales
permanecen en Git; el mapa ya no los importa para onboarding.

`convert-images-to-webp.py` conserva originales y no sobrescribe WebP existentes.
No se ejecuta dentro de la app. Requiere Pillow y revisión visual antes de cambiar
referencias. `generate-image-placeholders.py --check` verifica hashes y archivos.

Se conservaron los cinco stashes. No se recuperó `product-card-metrics.ts` porque
introducía alturas mínimas contrarias al diseño compacto actual. Tampoco el test
de AppScreen que asumía una barra superpuesta: la barra se integra en Tabs. La
skill de grilling del respaldo queda fuera del alcance. El test de recuperación
de ErrorBoundary se incorporó y pasa sin cambiar su implementación.

## Pruebas automáticas y límites

La validación local anterior al worktree limpio aprobó 63 suites unitarias
(319 pruebas) y 8 suites de integración (64 pruebas). TypeScript y los hooks de
commit verifican los archivos correspondientes. La validación definitiva del
último HEAD se realiza con `npm ci` y los comandos de TESTING.md en un worktree
independiente; sus logs y estado final se entregan en el informe de la tarea.

La cobertura añadida comprueba navegación con `navigate`, dobles toques, selección
de Perfil, nuevos parámetros de Catálogo, campana con caché real, destinos push
de la cuenta, sesión cerrada, eliminación de listeners, onboarding y recuperación
de ErrorBoundary. Los mocks nativos de Reanimated permiten probar acciones y
accesibilidad; no certifican interpolación, animación o fluidez nativa.

Maestro registra cinco flujos: catálogo público, detalle de muestra, carrito
invitado, onboarding y pestañas. El runner usa development build y una API pública
aislada de solo lectura. Sin dispositivo conectado se detiene antes de arrancar
Metro o tocar la app. Ese resultado significa pendiente, nunca aprobado.

## Revisión nativa pendiente

- Android/iOS: safe areas, teclado, fuentes grandes, contraste y lectores de pantalla.
- Cambios de pestaña, regreso desde login/detalle y conservación de scroll/búsqueda.
- Cantidades, deshacer y fechas de renta; no hay pago ni contratación nueva.
- Push real, permisos, foreground/background, arranque desde aviso y cambio de cuenta.
- Ejecución completa de los cinco flujos Maestro en una development build compatible.

Referencias: [pestañas de Expo Router](https://docs.expo.dev/router/advanced/tabs/),
[notificaciones](./NOTIFICATIONS.md), [carrito](./CART.md) y [pruebas](./TESTING.md).
