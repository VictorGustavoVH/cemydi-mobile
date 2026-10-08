# Toast global CEMYDI

Referencia: `toast-cemydi-contador-compacto.html`. Implementación nativa, sin WebView. Ruta temporal `/toast-demo`, accesible mediante Expo Router/deep link; no se añade a la navegación comercial. La demo identifica las operaciones como simuladas y permite fallos, pulsaciones consecutivas, transiciones a success/error/info y pruebas dentro de AppSheet.

## Archivos y montaje

- `src/providers/toast-provider.tsx`: store por instancia, contexto, lifecycle y superficie de blur.
- `src/hooks/useToast.ts`: API pública estable, sin suscripción de las pantallas a cada cambio.
- `src/components/ui/toast/`: store tipado, AnimatedToast, ToastIcon, UndoCountdown y ToastViewport; pruebas de lifecycle en `__tests__`.
- `src/app/_layout.tsx`: SafeAreaProvider y ToastProvider sobre Stack.
- `src/components/ui/AppSheet.tsx`: host local en el modal nativo; suspende visualmente el host raíz.
- `src/theme/colors.ts`: tokens semánticos específicos de toast.
- `src/features/toast-demo/ToastDemoScreen.tsx` y `src/app/toast-demo.tsx`: demo separada.
- `package.json` y lock: única dependencia añadida, expo-blur ~57.0.3 mediante expo install.
- `jest.setup.ts`: mocks de BlurView/Worklets y ampliación de Reanimated para el entorno sin runtime nativo.

Versiones verificadas: Expo 57.0.27, RN 0.86.3, Reanimated 4.5.1, Worklets 0.10.1, NativeWind 4.2.7, Lucide 1.52.0, SVG 15.15.4 y safe-area-context 5.7.0. No se modifica Babel, Metro, NativeWind ni proyectos nativos.

## Uso

```tsx
const toast = useToast();
toast.success('Producto agregado');
toast.error('No se pudo enviar la receta');
toast.info('Información actualizada');

const id = toast.loading('Enviando receta...');
try {
  await enviarReceta(); // Service/mutación con contrato confirmado.
  toast.update(id, { type: 'success', message: 'Receta enviada' });
} catch {
  toast.update(id, { type: 'error', message: 'No se pudo enviar la receta' });
}
// Una cancelación explícita puede llamar toast.dismiss(id).
```

Loading no expira. Los resultados duran 3800 ms por defecto; success/error/info aceptan duración como segundo argumento o dentro de update. La duración mínima es 1000 ms. La pantalla de demo es el único lugar con demoras artificiales.

```tsx
const id = toast.loading('Eliminando producto...');
try {
  await eliminarProducto();
  toast.update(id, {
    type: 'undo',
    message: 'Producto eliminado',
    duration: 6000,
    onUndo: async () => {
      await restaurarProducto();
      // Actualizar/invalidate la caché real después de confirmar.
    },
    errorMessage: 'No se pudo restaurar el producto',
  });
} catch {
  toast.update(id, { type: 'error', message: 'No se pudo eliminar el producto' });
}
```

También existe `toast.undoable({ message, duration, onUndo, errorMessage })` cuando la eliminación ya fue confirmada. `restoringMessage` y `restoredMessage` son configurables. La restauración cambia inmediatamente a loading, bloquea dobles pulsaciones y solo muestra éxito cuando resuelve la promesa. Los errores de onUndo se capturan.

## Política y contratos

Un toast visible; el más reciente reemplaza al anterior sin cola. Resultados idénticos se deduplican; cada loading obtiene un identificador nuevo para aislar operaciones incluso con mensajes iguales. Actualizaciones y callbacks de salida antiguos no afectan a una notificación nueva. Reemplazar, cerrar o desmontar cancela el temporizador de presentación; no cancela una operación real del servidor. Su cancelación y sus efectos de caché pertenecen al hook/service. La navegación mantiene las operaciones globales; la demo limpia sus propios temporizadores y notificaciones al salir.

La expiración comprueba tiempo absoluto, incluso después de regresar del background. El contador actualiza solo su componente una vez por segundo y el aro SVG usa Reanimated en el UI thread. El desmontaje visual espera la salida animada. Se desactivan rotación y transformaciones con reduced motion; el progreso temporal conserva su significado funcional.

Conectado al carrito de muestra: ProductDetailScreen muestra `Producto agregado` al añadir en compra o renta; CartPreviewScreen reemplaza su aviso inline anterior por `Producto eliminado` con contador de seis segundos y Deshacer. La restauración recupera cantidad, modalidad, selección y borrador con restoreItem, incluso al cambiar de pantalla mientras el provider de sesión siga montado. Estas operaciones locales son síncronas y no tienen esperas artificiales ni spinner de red. Solo puede deshacerse la eliminación representada por el toast visible más reciente. Las APIs de negocio continúan sin conectarse.

No se conectaron endpoints ni se asumió reversibilidad del backend. Antes de usar Deshacer, verificar controller/DTO/service y contrato de restauración. Si no puede restaurarse una eliminación confirmada, decidir una eliminación diferida: el dominio conserva el producto pendiente y controla confirmación/cancelación y persistencia incluso cuando otra notificación reemplaza esta. No usar el temporizador de presentación como temporizador de negocio. La API actual no ejecuta borrados al expirar ni simula restauraciones reales. Correo/receta deben expresar aceptación de procesamiento o entrega final según la respuesta real, sin atribuir entrega a una mera aceptación. Errores offline los aporta la operación, no se inventa conectividad en el toast.

## Apariencia, modales y validación móvil

Normal: mínimo 58, radio 18, icono 22 dentro de 24, mensaje 13. Deshacer: mínimo 48, radio 15, contador único 30 con radio SVG 12, mensaje 12.3, acción 12. Fondo blanco 72%, borde blanco 95%, sombra ligera. La acción usa brandStrong para legibilidad y área táctil ampliada. El ancho se adapta a safe areas y se limita a 480; texto admite escalado y varias líneas. No hay cierre extra ni icono de éxito junto al contador.

Entrada 300 ms con opacidad, desplazamiento -10 y escala .96; salida 220 ms. Icono/texto hacen fade al cambiar de estado, conservando el contenedor. La intensidad de blur queda fija. BlurTargetView precede al overlay para capturar el contenido dinámico en Android. AppSheet registra su propio ToastViewport. Para otros Modal nativos, añadir `ToastViewport modal` dentro del modal, después del contenido y con un blurTarget local; el zIndex raíz no atraviesa ventanas nativas. No hay soporte implícito para modales externos sin ese host.

Expo documenta diferencias de intensidad y costo de blur: Android anterior a API 31 usa RenderScript, más costoso que RenderNode. Se conserva blur real mediante dimezisBlurView; comparar en un Android antiguo. La sombra usa shadow* en iOS y elevation en Android, por lo que no será idéntica píxel a píxel. Referencia técnica: [Expo BlurView SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/blur-view/).

Verificación visual pendiente en Android/iOS reales: safe area con notch, 320–430 dp, fuente 200%, VoiceOver/TalkBack, modal, background durante contador, deshacer en el límite, interrupción de animaciones y blur sobre contenido en movimiento. Las pruebas Jest cubren lógica, no fluidez ni apariencia nativa. Este entorno Windows no proporciona simulador iOS; ADB ejecutado fuera del sandbox no encontró dispositivos conectados.

Validación automática: lint, typecheck y format:check correctos; 16 suites/92 tests aprobados, incluyendo concurrencia, expiración, desmontaje, restauración exitosa/fallida y host único en modal. Exportaciones Android e iOS con Metro y Hermes correctas. Jest y Hermes requirieron ejecución fuera del sandbox por permisos de sus archivos temporales. La exportación de JavaScript no equivale a prueba visual ni a build nativa instalada.
