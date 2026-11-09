# Solicitudes de renta

## Flujo móvil

Desde «Revisar carrito», una cuenta CLIENT con rentas abre `/solicitar-renta`.
Se adaptó el flujo de `RentalRequirementsDialog` de la web a dos pasos móviles:

1. Datos del solicitante, paciente cuando sea otra persona, forma de entrega,
   domicilio condicional, horario y notas.
2. Revisión de todas las rentas guardadas, fechas, recetas, importes y aceptaciones
   de condiciones y privacidad. Los enlaces legales conservan el formulario al volver.

La selección del carrito solo sirve para la revisión local. El endpoint de renta
incluye todas las líneas RENTA, sin selección parcial. Las compras permanecen en
el carrito. El envío muestra el folio y total confirmados y acceso al detalle
existente de Mis rentas; la aprobación sigue siendo responsabilidad de CEMYDI.

La pantalla de confirmación (`Solicitud enviada`) incorpora `RentalSuccessCheckmark`
(en `src/features/cart/components/RentalSuccessCheckmark.tsx`), que anima el trazo
circular en `react-native-svg`, el asentamiento por resorte amortiguado y el barrido
progresivo de la palomita (`Check` de `lucide-react-native`) en el hilo de UI con
Reanimated y feedback háptico de éxito (`expo-haptics`), degradando a estado estático
cuando movimiento reducido está activo. El recibo organiza jerárquicamente el folio,
estado (`AccountStatusBadge`), equipos y fechas solicitadas, desglose de renta y
depósito en garantía, modalidad de entrega en sucursal y acciones hacia el detalle
de la solicitud o el carrito.

Se reutilizan AppScreen para safe areas, scroll y teclado, AppInput, AppButton,
AppSwitch y RentalConfigurationSheet. El diseño usa fondo blanco, tokens de marca,
secciones con separadores y controles con etiquetas y roles accesibles.

## Contratos comprobados

Se revisaron RentalsController, CreateRentalFromCartDto, RentalsService.createFromCart,
RentalDocumentsService, RolesGuard y los límites de uploads del backend local.

| Método | Ruta                                       | Comportamiento                                                                                     |
| ------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| POST   | `/rentals/from-cart`                       | Recibe datos de solicitante/paciente/entrega y ambas aceptaciones; devuelve `{ message, rental }`. |
| POST   | `/rentals/cart-items/:itemId/prescription` | Multipart con un campo `file`; devuelve `{ message, document }`.                                   |
| DELETE | `/rentals/cart-items/:itemId/prescription` | Desvincula receta; devuelve `{ message }`.                                                         |

Se conservan Bearer, renovación y cliente HTTP compartidos. Los schemas de renta
son compartidos por solicitud y cuenta en `src/services/rentals`; los cuerpos y
respuestas se validan con Zod. Disponibilidad, fechas mínimas, promociones,
depósitos y creación transaccional pertenecen al servidor.

Las recetas se eligen con `expo-document-picker ~57.0.3`, instalado mediante
`npx expo install`, porque el stack anterior no tenía selector nativo de archivos.
Se contrastó la [documentación SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/).
Se aceptan PDF, JPG/JPEG, PNG y WebP de hasta 8 MB, según el backend actual.
FormData incluye nombre/MIME y un lector `bytes()` para el serializador de fetch
de Expo 57, que no admite partes con solo URI. El lector no es enumerable para
conservar también la compatibilidad con `getParts()` del transporte React Native,
sin enviar funciones al puente nativo. No se fija Content-Type manualmente.
Cancelar el selector no escribe. La validación de contenido del servidor prevalece.
El selector se importa al usarlo; una development build anterior necesita reconstruirse
para incluir el módulo nativo. Se conserva CNG, sin editar proyectos nativos.

Se añadió `expo-file-system ~57.0.7` con `npx expo install` para verificar el tamaño
real de la copia local y leer sus primeros 12 bytes durante la validación. El
serializador lee el contenido completo al enviar, dentro del límite de 8 MB.
Se comprueba coherencia
entre firma, extensión y MIME antes de subir, incluso si el selector no informa
tamaño. Solo se leen copias dentro de la caché `DocumentPicker`; no se aceptan URLs
remotas ni rutas del archivo original. Los nombres enviados eliminan separadores,
controles y caracteres de dirección de texto. La copia se elimina al rechazar o
fallar la subida y al desmontar el componente; una subida correcta conserva la
copia mientras se muestra su vista previa local. Si cambia la sesión o el
componente se desmonta durante la subida/apertura externa, se elimina cuando
termina esa operación. La limpieza local sigue siendo de mejor esfuerzo.

Desde el 8 de noviembre de 2026, `initializePrescriptionCache` elimina las copias
residuales de un proceso anterior al montar `AuthProvider`, antes de restaurar
sesión. También se exige antes de abrir el primer selector: no se admiten nuevas
copias si la limpieza falló, y el siguiente intento permite reintentar con un error
comprensible. El acceso a la app sigue disponible si falla esa limpieza.
Se utiliza la API `Directory`/`File` de
[Expo FileSystem SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/), ya
instalada. Solo se eliminan archivos directos dentro de la caché interna
`DocumentPicker/`, donde el selector Android 57.0.3 crea sus copias, incluidos
archivos parciales. No se recorren subdirectorios ni se borran originales u otras
cachés; se rechazan rutas remotas, ajenas o ambiguas.

La limpieza de arranque se completa una vez por proceso, antes de permitir el
selector. Un remonte del provider o un cambio de cuenta no repiten el barrido sobre
copias del proceso actual que podrían seguir subiendo o abiertas en un visor.
Se conserva `dispose()` para esas copias. Un cierre forzado no ejecuta código de
limpieza: el residuo se retira al abrir de nuevo la app; no se afirma borrado
inmediato mientras permanece cerrada ni cifrado adicional del archivo.

Las imágenes elegidas tienen vista previa local con `cachePolicy="none"`. Un PDF
local ofrece «Abrir PDF con otra aplicación» solo mediante una acción explícita.
El botón incluye aviso visible y accesible de que la aplicación elegida tendrá
acceso a la receta y podría conservar una copia fuera del control de CEMYDI.
No se abre automáticamente ni se garantiza eliminar copias guardadas por terceros.
El sistema sigue eligiendo el destino; no se añadieron aplicaciones o proveedores.
La descarga de recetas previas desde el servidor sigue fuera de alcance.

El backend vuelve a validar contenido/tamaño y propiedad de la línea, aplica un
límite de frecuencia y guarda en Cloudinary con tipo `authenticated` e identificador
aleatorio. La firma es una comprobación de formato, no un análisis antimalware:
en el servicio revisado no se observó integración de antivirus ni desarmado de PDF.
El móvil no ejecuta ni abre automáticamente los documentos adjuntos. Una receta
por equipo es el contrato existente; no se incorporan otros tipos de documentos.

## Conectividad y resultados inciertos

Las acciones usan el bloqueo de escrituras de CartProvider y pausan el sondeo.
Después de cargar o quitar receta se consulta el carrito completo. El envío no se
reintenta automáticamente. Un fallo de red, timeout, parseo o servidor obliga a
consultar Mis rentas y comprobar el carrito antes de repetir. Si la creación fue
confirmada pero falla la consulta posterior del carrito, se conserva el recibo y
se muestra éxito sin reenviar. Cada resultado verifica la identidad y versión de
sesión; cerrar sesión desmonta los datos personales del formulario.

## Verificación y límites

### Calendario y fechas

Inicio y devolución usan `AppDateInput` con el selector nativo
`@react-native-community/datetimepicker` 9.1.0, instalado con `npx expo install`
y su config plugin en `app.json`. Se verificó la
[documentación de Expo 57](https://docs.expo.dev/versions/v57.0.0/sdk/date-time-picker/).
Se necesita reconstruir la development build para incluir el módulo nativo.
No se editan proyectos Android/iOS generados.

La fecha mínima es hoy en `America/Mexico_City`, igual que el backend; la devolución
no puede ser anterior al inicio. Si un cambio de inicio invalida la devolución,
se limpia ese campo. Las fechas seleccionadas se serializan por componentes de
calendario, sin convertirlas a UTC ni desplazar un día. Las fechas previas ya
vencidas muestran error, no se sustituyen silenciosamente. Se reevalúa el día al
volver a primer plano, cada minuto y justo antes de guardar/enviar. Las rentas
guardadas con fechas pasadas bloquean el envío hasta corregirse. El backend
conserva la validación definitiva de fechas, mínimo de días y disponibilidad.

Las pruebas cubren DTO condicional, aceptaciones, Bearer, multipart, respuestas
inválidas, red, carga/eliminación de receta, conservación de compras, confirmación
con recarga fallida y bloqueo offline/cambio de sesión.

Validación local del 30 de octubre de 2026: `npm test -- --ci` aprobó 78 suites y
422 pruebas; TypeScript y exportación de bundles Android/iOS aprobados. El chequeo
de formato identifica únicamente un cambio previo en
`src/features/auth/services/auth-session.ts`, ajeno al módulo de renta.

El 31 de octubre se corrigió la serialización de archivos y se comprobó con el
serializador real instalado de Expo 57: bytes del PDF, MIME, nombre y compatibilidad
del puente React Native. Los errores de adjuntos y operaciones de carrito/renta
aparecen en toast; la validación de campos permanece junto al campo y los avisos
persistentes de conectividad o resultados inciertos se conservan.

El 31 de octubre de 2026 el usuario confirmó que la subida de archivos funciona
en el APK Android actualizado. La revisión visual completa Android/iOS, teclado,
fuentes grandes y lector de pantalla sigue pendiente. Jest no sustituye estas
comprobaciones.

Fuera de esta entrega: descarga/vista previa/compartición de recetas y reemplazo
de documentos rechazados desde una solicitud ya creada. Consultar, detallar y
cancelar solicitudes pendientes conserva el comportamiento existente.

## Verificación de privacidad pendiente en Android — 8 de noviembre de 2026

Las regresiones simulan archivos residuales y parciales, errores de listado/borrado,
reintento, preservación de originales/otras cachés y de copias del proceso actual.
Se comprueba también que la limpieza precede a la restauración y que no se abre el
selector si falla. La integración mantiene subida, vista previa, apertura PDF
expresa y eliminación de la copia al cerrar el formulario.

No había dispositivo Android conectado en esta revisión. Queda comprobar con una
receta de prueba: forzar el cierre durante la copia/subida, volver a abrir y verificar
la eliminación del residuo en `DocumentPicker/` conservando el original. Repetir con
imagen y PDF, cancelar el selector y abrir el PDF en un visor externo. La limpieza
propia no demuestra que ese visor descarte sus copias. No se declara aceptación
nativa a partir de Jest ni cumplimiento legal por esta medida.

Validación local: lint, TypeScript y formato aprobados. `npm test -- --runInBand`
aprobó 103 suites y 620 pruebas; evidencia en
`test-results/security/cart-remediation-jest.json` y `.log`. La suite registró
avisos de `act` en pruebas de componentes, sin fallos. No se suprimieron esos avisos
ni se sustituyó la comprobación nativa pendiente por los resultados simulados.
