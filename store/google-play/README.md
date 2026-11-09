# Preparación de Google Play

Material preparado el 8 de noviembre de 2026. Los textos describen funciones del cliente actual; no acreditan aceptación en dispositivo ni autorización de Google Play.

## Ficha en español de México

Los archivos en `es-MX/` contienen título, descripción corta, descripción completa y notas de versión para copiar en Play Console. Categoría propuesta: Compras, sujeta a revisión del responsable. No se afirma que la app procese pagos ni cree pedidos de venta.

Contacto publicado por la app: contacto@cemydi.com. Sitio: https://ortopedia-cemydi.netlify.app/. El responsable debe confirmar que atiende ese buzón antes de publicarlo.

En `graphics/` están el icono PNG 512 x 512, renderizado desde el símbolo vectorial existente de la marca, y el gráfico promocional PNG RGB 1024 x 500 con su fuente SVG. Ambos se revisaron visualmente. Textos alternativos sugeridos:

- Icono: Símbolo de Ortopedia CEMYDI.
- Gráfico: Ortopedia CEMYDI: catálogo de productos y solicitudes de renta para tu cuidado.

Estos materiales están preparados para revisión; no se cargaron a Google. En
`es-MX/phone-screenshots/` se incluyen cuatro capturas reales de la build 1.0.0 (1)
ejecutada en un emulador aislado Android 17 de 16 KB: bienvenida, inicio, catálogo y
carrito de invitado. Se conservaron los píxeles RGB originales y solo se quitó el
canal alfa completamente opaco para producir PNG de 24 bits; no se retocó la UI.
Miden 1080 x 1920. Revisarlas de nuevo si cambia la versión a distribuir.

Textos alternativos sugeridos para las capturas:

- Bienvenida de CEMYDI con acceso al catálogo.
- Inicio con categorías de equipo y acceso a búsqueda.
- Catálogo con filtros, productos y precios.
- Carrito de invitado con un producto y controles de cantidad.

Enlaces públicos comprobados con HTTP 200 durante esta preparación:

- Privacidad: https://ortopedia-cemydi.netlify.app/politicas-de-privacidad.
- Eliminación de cuenta: https://ortopedia-cemydi.netlify.app/eliminar-cuenta.

La política publicada no contenía los indicadores de demostración comprobados. Esto no sustituye revisar su contenido, responsable legal, retención, proveedores y correspondencia con el inventario de datos.

## Compilación

`npm run release:bundle` genera por CNG un AAB Release con la firma local existente y la API HTTPS confirmada, sin instalarlo ni publicarlo. Salida: `android/app/build/outputs/bundle/release/app-release.aab`. No ejecutar `release:key` para reemplazar una identidad de firma existente.

EAS production declara explícitamente `android.buildType=app-bundle`. La firma administrada por EAS y la firma local pueden ser distintas: verificar cuál se registra como clave de carga en Play Console antes de publicar. No alternarlas sin comparar certificados. No se ha registrado todavía una clave de carga en Play desde esta tarea.

Conservar de la misma compilación AAB, mapping R8, certificado público, SHA-256, logs y revisión de código. Un AAB firmado no equivale a una versión aceptada. La firma definitiva de distribución de Play App Signing requiere registrar sus huellas en Google Cloud para Google Sign-In; las huellas de la clave local o de carga no la sustituyen.

## Estado de Play Console

La cuenta de Google abierta en Brave mostró el formulario de creación de cuenta de desarrollador. No se eligió un tipo de cuenta, no se aceptaron acuerdos ni se efectuaron pagos. Si existe otra cuenta de desarrollador, abrirla o recibir invitación; en caso contrario, el titular debe completar registro, verificación y cargos que Google solicite.

## Pendiente antes del envío

1. Confirmar titular, tipo y verificación de la cuenta de desarrollador y el paquete com.cemydi.app.
2. Registrar firma de Play y huellas OAuth correctas; verificar acceso Google en la versión distribuida por Play.
3. Revisar el inventario de datos y la política real con el responsable; completar Seguridad de datos, público objetivo, anuncios, clasificación de contenido y declaración de aplicaciones de salud cuando corresponda. No responder formularios por inferencia.
4. Proporcionar acceso de revisión funcional a las áreas privadas. Como registro y cambios usan OTP, acordar un mecanismo de acceso compatible con las reglas de revisión de Google; no guardar contraseñas ni OTP en este repositorio.
5. Revisar las cuatro capturas incluidas frente a la versión que se distribuirá. No contienen una cuenta real ni herramientas de desarrollo. Los gráficos promocionales no sustituyen capturas de la app.
6. Ejecutar aceptación de sesión, OTP, logout/restauración, catálogo, carrito/rentas, recetas, conectividad, accesibilidad y push real con la build actual.
7. Subir primero a pruebas y revisar el informe previo al lanzamiento, compatibilidad de dispositivos, bibliotecas nativas y páginas de memoria de 16 KB. No acreditar esto por la versión del SDK solamente.
8. Cumplir el período y número de testers exigidos por la cuenta. Para las cuentas personales a las que aplica la política vigente, Google indica 12 testers durante 14 días continuos; revisar la condición concreta en Console.
9. Enviar a producción después de resolver los bloqueos y aceptar los resultados de prueba.

## Fuentes oficiales consultadas

- [Recursos gráficos y límites](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en): icono PNG 512 x 512, gráfico promocional 1024 x 500 y descripción corta de hasta 80 caracteres.
- [Pruebas para cuentas personales nuevas](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-en).
- [Seguridad de datos](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).
- [Eliminación de cuentas](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).
