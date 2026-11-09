# Inventario preliminar para Seguridad de datos

Este inventario describe el código revisado. No es una declaración enviada a Google ni una conclusión legal. Validar configuración desplegada, proveedores y retención antes de responder el formulario.

| Datos observados                                              | Flujo y propósito                                                          | Revisión pendiente                                                                                                                                                   |
| ------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nombre, correo, teléfono, dirección e identificador de cuenta | Registro, autenticación, perfil y entrega de rentas                        | Determinar obligatoriedad por flujo, destinatarios y conservación efectiva                                                                                           |
| Identidad Google y token de autenticación                     | Acceso opcional mediante Google y validación en backend                    | Revisar configuración OAuth y tratamiento del proveedor                                                                                                              |
| Favoritos y contenido del carrito                             | Funcionalidad de cuenta y sincronización con backend                       | Declarar como interacciones u otra categoría que corresponda al formulario                                                                                           |
| Solicitudes, fechas y notas de renta                          | Prestación del servicio y seguimiento                                      | Examinar notas libres y clasificación del historial; no hay procesamiento de pagos de venta implementado                                                             |
| Recetas e imágenes/PDF elegidos por el usuario                | Documentos de solicitud; pueden contener datos de salud                    | Revisar las categorías de salud, fotos y archivos aplicables y el proveedor de almacenamiento. No declarar ausencia de datos sensibles                               |
| Valoraciones y comentarios                                    | Reseñas de productos y moderación                                          | Parte del contenido se publica según moderación; informar al usuario                                                                                                 |
| Token Expo Push, instalación/dispositivo y preferencias       | Registro y entrega de notificaciones opcionales                            | Expo Push y FCM participan; revisar identificación, retención y tratamiento como proveedor de servicio o compartición según las definiciones de Google               |
| Audio de búsqueda por voz                                     | Servicio de reconocimiento del dispositivo; el móvil no guarda grabaciones | El servicio puede procesar audio fuera del dispositivo. Revisar proveedor/SDK y criterios de tratamiento efímero; no marcar automáticamente que no se recopila audio |
| IP, registros técnicos y datos de diagnóstico del servidor    | Pueden derivarse del alojamiento, seguridad y operación                    | Confirmar logging y retención de Render/backend y proveedores; el cliente no basta para responder                                                                    |

## Proveedores que deben contrastarse con el despliegue

Backend y base de datos, alojamiento Render, autenticación Google, correo Brevo, almacenamiento de documentos y medios, Expo Push/FCM y servicio de reconocimiento de voz. Las dependencias de la app no muestran una integración explícita de anuncios ni SDK dedicado de analítica, pero eso no demuestra ausencia de telemetría de cada SDK o proveedor.

No equiparar automáticamente enviar a un proveedor de servicio con compartir según Play. Revisar los acuerdos, finalidades y las excepciones de su formulario. El envío por HTTPS observado no acredita por sí mismo cifrado en reposo ni plazos de eliminación.

## Eliminación y conservación

La app ofrece solicitud de eliminación con correo y OTP. El código del servidor contempla obligaciones de rentas/depósitos, procesamiento en segundo plano y eliminación de archivos antes de finalizar; el usuario puede necesitar resolver obligaciones. Los plazos y tratamiento de respaldos deben coincidir con la política efectiva. No prometer borrado inmediato ni un plazo inventado.

La URL pública de eliminación respondió HTTP 200, pero no se enviaron solicitudes de eliminación ni se probaron OTP con una cuenta real. La existencia de la página no acredita el funcionamiento completo del flujo desplegado.

Fuentes de código: src/features/profile/account-deletion-service.ts, src/features/profile/support-content.ts, src/services/permission-rationale.ts, docs/NOTIFICATIONS.md, docs/RENTALS.md y módulos users/legal-documents del backend local.
