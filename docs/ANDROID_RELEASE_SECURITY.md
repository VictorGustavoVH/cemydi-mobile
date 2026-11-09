# Seguridad y entrega Android

Alcance: requisitos de JWT/cloud, anti-MitM/cifrado, ofuscación, caja negra,
instalable y permisos. Derechos ARCO y publicación en Google Play quedan excluidos.
La política vigente usa TLS estándar y CA del sistema en Android. iOS queda fuera
de esta revisión; no se acredita aceptación nativa allí.

## Configuración reproducible por CNG

`plugins/with-android-security.cjs` configura el proyecto generado, sin editarlo
manualmente:

- OkHttp conserva la validación estándar de cadena TLS y hostname, junto con el
  cliente y cookie jar base de React Native. No se instalan TrustManager ni
  HostnameVerifier personalizados y no se fijan claves públicas del proveedor.
- Network Security Config declara exclusivamente CA del sistema. Release rechaza
  HTTP; recursos de Debug/debugOptimized permiten HTTP para Metro y API local,
  conservando validación TLS y CA del sistema para HTTPS.
- Desactiva redirecciones del cliente React Native para evitar reenviar Bearer a
  otro origen. La API debe servir directamente las rutas contratadas.
- R8 y reducción de recursos en Release. Las reglas ProGuard nativas de las
  dependencias se conservan; no se añaden reglas globales que mantengan todas las clases.
- `allowBackup=false`, HTTP desactivado y eliminación del permiso de superposición
  del manifiesto principal. El manifiesto Debug conserva el acceso local de Metro.
- Almacenamiento externo amplio bloqueado. Las recetas usan el selector de
  documentos del sistema; no requieren cámara, ubicación ni acceso general al almacenamiento.

La sesión existente mantiene access token en memoria y refresh en SecureStore.
No se cambió el transporte de autenticación. SecureStore no implica cifrado de
todos los archivos de caché: los documentos temporales usan la limpieza existente.

## TLS estándar de Android — política vigente

El 8 de noviembre de 2026 el usuario aprobó sustituir pinning por validación HTTPS
estándar para el backend administrado por Render. Se retiraron los pins fijos y
el requisito de una clave de respaldo para compilar. El origen público de
`release:android` está en `config/android-api.json`; `EXPO_PUBLIC_API_URL` en
production debe ser HTTPS y no contener credenciales. Un proyecto generado para
API HTTP de desarrollo sigue bloqueando Release en Gradle y al arrancar: debe
regenerarse por CNG con una URL HTTPS.

El plugin genera `cemydi_network_security_config.xml` en main (HTTP prohibido) y
en debug/debugOptimized (HTTP disponible para Metro). Las tres variantes confían
solo en `system`, sin CA del usuario ni certificados adicionales. Se mantienen
las redirecciones desactivadas, firma dedicada, R8, permisos limitados y backups
bloqueados. CNG reemplaza los bloques TLS/Gradle de la implementación anterior;
no se editan proyectos nativos manualmente.

Motivo: [Render administra y renueva los certificados](https://render.com/docs/tls)
y no hay una política de claves futuras controlada por CEMYDI. Android advierte
que el pinning puede interrumpir la conectividad tras cambios de servidor y no
lo recomienda de forma general. Se adopta su validación estándar, aceptando el
riesgo residual de una CA del sistema comprometida que el pinning restringiría.
Referencias: [TLS en Android](https://developer.android.com/privacy-and-security/security-ssl)
y [Network Security Config](https://developer.android.com/privacy-and-security/security-config).

Diagnóstico público, sin autenticación ni mutaciones:

```powershell
npm run security:tls -- https://cemydi-backend-a9et.onrender.com/
```

El reporte `test-results/security/tls/observed-chain.json` verifica TLS desde Node
y registra certificados/huellas observados; no configura pins en la app ni
acredita validación del almacén de Android. Los APK antiguos siguen usando su
política anterior hasta instalar una nueva build nativa; una OTA no la cambia.

`npm run test:release-security` comprueba la política y genera un proyecto CNG
aislado con el template de Expo 57 instalado, sin descargar dependencias ni
modificar `android/` local. Verifica los recursos main/debug/debugOptimized y la
migración de los antiguos bloques de pinning. Evidencia bajo
`test-results/security/system-tls-cng/`. No equivale a compilar o ejecutar un APK.

## Firma e instalable local

Requiere JDK en `JAVA_HOME`, Android SDK y una API HTTPS. No conecta con Play
Console ni publica. Desde la raíz del proyecto:

```powershell
npm run release:key
npm run release:android
```

`release:key` crea una identidad RSA de 3072 bits y credenciales en `.credentials/`,
ignoradas por Git; nunca reemplaza una clave existente ni imprime contraseñas.
Guardar una copia privada protegida de esa carpeta antes de distribuir. Su pérdida
impide actualizar instalaciones firmadas con ella. No compartir `signing.json`.
La firma es distinta de Debug: no sustituir instalaciones existentes borrando sus
datos sin autorización. Para Google Sign-In nativo, registrar la huella pública
de esta firma en el cliente OAuth Android correspondiente; `signature.txt` del
reporte incluye las huellas. Ese acceso nativo debe comprobarse en dispositivo.

`release:android` carga el entorno local sin imprimir valores, fuerza production y
la API confirmada (o `CEMYDI_RELEASE_API_URL` si se configura otro origen),
valida HTTPS, ejecuta prebuild y `assembleRelease` con firma propia. No instala ni
borra datos del teléfono. El APK queda en
`android/app/build/outputs/apk/release/app-release.apk`; R8 genera
`android/app/build/outputs/mapping/release/mapping.txt`.

Para el formato de Google Play, `npm run release:bundle` reutiliza esa misma
configuración y firma, ejecutando `bundleRelease` en lugar de `assembleRelease`.
Produce `android/app/build/outputs/bundle/release/app-release.aab`, sin instalar ni
publicar. La preparación de ficha, datos y aceptación está en
[store/google-play/README.md](../store/google-play/README.md). Antes de cargarlo,
comparar el certificado con la clave de carga registrada en Play; EAS y la firma
local no se consideran equivalentes automáticamente.

La preparación de Play del 8 de noviembre detectó saturación del límite de
Metaspace de 512 MB durante el empaquetado. `with-android-java.cjs` eleva por CNG
ese valor predeterminado a 1024 MB, conservando el límite de heap y ajustes
personalizados. Los comandos locales de Release limitan Gradle a dos workers y
conservan stacktraces. El diagnóstico inicial se guarda en
`test-results/play-release-2026-11-08/`; no se considera una build aprobada.

EAS conserva su provisión de firma administrada; no se inicia una build remota
automáticamente. Preview y production deben recibir URL HTTPS; el origen confirmado
ya no requiere pins ni clave de respaldo. El bloqueo por firma dedicada continúa
vigente. Esto no modifica los APK ya instalados.

## Inspección del artefacto

Instalar la distribución oficial de JADX fuera del repositorio y apuntar
`CEMYDI_JADX_HOME` a su carpeta (con `lib/`). Después:

```powershell
npm run release:inspect -- android/app/build/outputs/apk/release/app-release.apk android/app/build/outputs/mapping/release/mapping.txt
```

Usa Android build-tools (`aapt2`, `apksigner`) y JADX sobre una muestra explícita:
`MainApplication` y una clase renombrada de la app (o una clase de dependencia si
no hay una de la app disponible). No es una auditoría completa del
binario. Conserva SHA-256, firma,
manifiesto final, mapping, versión/log de JADX y código decompilado bajo
`test-results/release/`. Rechaza APK depurable, firma Debug, permisos amplios,
backup/HTTP habilitados y mapping sin renombrado. Un error no se transforma en éxito.
El mapping debe proceder de la misma compilación del APK: conservar juntos ambos
artefactos y el log del build. La comprobación no prueba por sí sola esa procedencia.

R8 dificulta el análisis y reduce código; no impide toda descompilación. Revisar el
resultado JADX y documentar qué clases fueron renombradas y qué metadatos siguen
visibles. El reporte estático no sustituye a pruebas TLS ni a caja negra.

## Matriz de aceptación en dispositivo

Ejecutar con el mismo APK firmado, sin Metro, contra backend de prueba autorizado.
No usar la API simulada de Maestro como evidencia de integración real. Registrar
modelo/Android, versión, SHA del APK, fecha, pasos, esperado, observado, estado y
ruta de captura/video. REL-01 se comprobó durante el diagnóstico del dispositivo;
los demás casos completos permanecen pendientes. SEC-01 corresponde a la
inspección estática ya ejecutada.

| ID     | Prueba de caja negra                                            | Resultado esperado                                       | Estado    |
| ------ | --------------------------------------------------------------- | -------------------------------------------------------- | --------- |
| REL-01 | Instalar y abrir APK sin Metro                                  | Arranque operativo, sin Dev Launcher                     | Aprobado  |
| REL-02 | Registro, OTP, login, restauración, logout                      | Backend acepta flujo; sesión cerrada no se restaura      | Pendiente |
| REL-03 | Catálogo, búsqueda, detalle y carrito                           | Lecturas/escrituras reales y errores comprensibles       | Pendiente |
| REL-04 | Perfil/rentas/notificaciones existentes                         | Solo datos de la cuenta y estados válidos                | Pendiente |
| REL-05 | Modo avión, reintento y reconexión                              | Sin éxitos falsos ni pérdida de credencial segura        | Pendiente |
| REL-06 | Voz: cancelar explicación, denegar, aceptar, revocar en ajustes | Sin solicitud tras cancelar; búsqueda escrita disponible | Pendiente |
| REL-07 | Push: cancelar explicación, denegar, aceptar                    | Bandeja disponible; solicitud solo a demanda             | Pendiente |
| REL-08 | Selector de recetas, cancelar y seleccionar                     | Solo archivo seleccionado, sin permiso amplio de disco   | Pendiente |
| TLS-01 | Conexión directa con cadena TLS válida                          | API operativa                                            | Pendiente |
| TLS-02 | Proxy de prueba con CA instalada solo por el usuario            | API rechazada; sin exposición de Bearer                  | Pendiente |
| TLS-03 | Backend de prueba con nueva clave y cadena confiable            | API operativa                                            | Pendiente |
| TLS-04 | Certificado expirado, CA no confiable o hostname incorrecto     | API rechazada por validación TLS                         | Pendiente |
| SEC-01 | Revisar manifiesto, firma, mapping y JADX                       | Inspección aprobada y reporte conservado                 | Aprobado  |

TLS-02/03/04 requieren certificados y servidores de prueba controlados. No alterar
credenciales ni datos reales. Probar en Release que una CA solo del usuario no se
acepta, que una rotación con cadena confiable funciona y que los certificados
inválidos se rechazan. Estos casos siguen pendientes en Android físico.

Registro histórico de pinning (no certifica la política vigente): se ejecutó
`scripts/security/PinProbe.java` con JDK 24, OkHttp 4.12.0 y la cadena
real de la API: validación TLS/hostname del sistema y pin configurado aceptados;
un pin SHA-256 ajeno fue rechazado con `SSLPeerUnverifiedException` de
CertificatePinner. Evidencia: `test-results/security/tls/okhttp-jvm.log`.
Es una prueba de red en JVM de escritorio, no la ejecución de TLS-01/02/04 en Android.

Los cinco flujos Maestro de desarrollo existentes siguen siendo regresiones Debug.
Su runner exige Dev Launcher: no se usa contra Release ni se etiqueta como tal.
Repetir los recorridos aplicables en Debug y Release, comparando resultados.

Registro de errores por cada fallo: ID, caso, APK/commit, pasos, esperado/observado,
evidencia, causa, cambio correctivo, APK corregido, fecha y evidencia del retest.
No cerrar errores ni marcar casos aprobados hasta ejecutar ese retest.

## Estado de entrega

APK universal firmado generado en `android/app/build/outputs/apk/release/app-release.apk`.
SHA-256 inicial: `c095a2e9325f8d0a3df45275c0a7b77caad01962676aefd242445e15042cf161`.
`assembleRelease` aprobó en 17 min 51 s. La inspección estática aprobó sin incidencias
en su alcance: firma RSA dedicada, APK no depurable, backups/HTTP desactivados,
9427 entradas de clases renombradas en el mapping y muestra JADX de `MainApplication`
y `MainActivity$createReactActivityDelegate$1` (renombrada `R3.a`).
Evidencias: `test-results/security/release-build.log` y
`test-results/release/2026-10-31T05-54-23-908Z/` (reporte Markdown/JSON, firma,
manifiesto, mapping y fuentes decompiladas).

Las lecturas HTTP públicas `/products` y `/users/me` devolvieron 200/JSON en la
segunda comprobación. Se conservó también el timeout inicial de 45 segundos;
no se atribuye una causa sin evidencia. No se probaron credenciales ni login real.

Incidencias de compilación corregidas y comprobadas con el mismo build final:

| ID       | Fallo observado                                             | Corrección                                            | Retest                     |
| -------- | ----------------------------------------------------------- | ----------------------------------------------------- | -------------------------- |
| BUILD-01 | Ninja repetía CMake por rutas largas en prefab de Worklets  | Staging corto por módulo en `with-android-cmake.cjs`  | `assembleRelease` aprobado |
| BUILD-02 | Ruta de objeto del codegen de gestos excedía 260 caracteres | Límite 250 en app para permitir hash de ruta de CMake | `assembleRelease` aprobado |

Los logs fallidos quedan en `test-results/security/release-build-long-path-failure.log`
y `release-build-codegen-path-failure.log`. Son incidencias de compilación, no
pruebas funcionales de caja negra.

Siguen pendientes la matriz en dispositivo, proxy MitM nativo, clave de respaldo
y política de rotación de Render. ARCO y publicación en Play están excluidos.
No declarar aceptación funcional de Release por haber compilado e inspeccionado el APK.

### Actualización de diagnóstico del 31 de octubre de 2026

El APK actual tiene SHA-256
`08e8d68e2f47238798bb5d28ef88be068f691434c5c2f45dc18f5b7880005f07`.
La recompilación conservó la firma dedicada y se instaló como actualización sin
borrar datos. Inspección estática aprobada:
`test-results/release/2026-10-31T07-36-29-285Z/`.
El build queda registrado en `test-results/native-diagnosis/rebuild-fixed.log`.

| Incidencia | Evidencia y corrección                                                                                                                                                        | Retest                                                                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MIC-01     | Expo 57 rechazaba el Record anidado `recordingOptions`. Se omite esa opción; el valor nativo predeterminado no persiste audio.                                                | Usuario confirmó dictado correcto en Huawei STK-LX3, Android 10, con el APK actual. Los casos de denegación/revocación de REL-06 siguen pendientes.                                      |
| FILE-01    | fetch de Expo 57 no serializaba una parte FormData con solo URI. Se proporciona lector de bytes compatible con ambos transportes.                                             | Prueba con el serializador real instalado aprobada. El usuario confirmó subida correcta desde el APK Android actualizado el 31 de octubre de 2026.                                       |
| GOOGLE-01  | Tras elegir cuenta, Credential Manager devolvía `[16] Account reauth failed` sin identidad. Se comprobó otra firma registrada en Google Cloud y coincidencia del cliente Web. | Se creó «Cemydi Android Release local» con confirmación del usuario, conservando el cliente anterior. El usuario confirmó acceso correcto con Google en el mismo APK después del cambio. |

Se comprobó apertura del Release instalado sin Metro, además del dictado; esto
no aprueba los demás recorridos de la matriz. Los errores operativos de micrófono,
Google, cupones, recetas y solicitud aparecen en el toast existente, sin sustituir
errores de campo ni avisos persistentes de operaciones inciertas.

Validación de las correcciones: lint, typecheck y format:check aprobados; seis
suites dirigidas, 35 pruebas aprobadas. La ejecución completa anterior aprobó
82 suites y 445 pruebas; las suites dirigidas cubren los cambios posteriores.

Referencias: [Android: optimización con R8](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization),
[Android: configuración de seguridad y pins SPKI](https://developer.android.com/privacy-and-security/security-config).

### Validación actual de auditoría — 2 de noviembre de 2026

El árbol actual aprobó TypeScript y ESLint. La regresión completa
`npm test -- --runInBand` aprobó **95 suites y 516 pruebas**, sin fallos, omitidos ni
el aviso de salida tardía de Jest. Resultado JSON: `test-results/audit-complete.json`;
log: `test-results/audit-complete.log`. Tras aislar los fixtures, la ejecución final
con `--detectOpenHandles` volvió a aprobar 95 suites y 516 pruebas, sin handles
detectados; JSON: `test-results/audit-release-check.json`. El formato y diagnóstico se
registran en [AUDIT_CORRECTIONS.md](./AUDIT_CORRECTIONS.md), junto con las limitaciones.

Estas cifras actualizan la validación de código; no acreditan un nuevo build o
retest del APK histórico. No hubo dispositivo/emulador conectado para aceptación
nativa. Se conservan los resultados históricos del 31 de octubre con su fecha.

### Correcciones de seguridad — 8 de noviembre de 2026

- **Hallazgo 1:** `/users/me` con usuario ausente o inactivo expira la sesión;
  elimina tokens/credencial y dispara la limpieza de caché del provider. Se cubren
  edición simultánea de perfil y respuestas de sesiones anteriores. Revisión del
  backend local: `src/modules/auth/strategies/jwt.strategy.ts` ya exige cuenta
  activa consultando la base; `auth-session.service.ts` también la exige al
  renovar. No fue necesario modificar el servidor. No se afirma que el despliegue
  remoto tenga la misma revisión de código.
- **Hallazgo 2:** el usuario eligió inicialmente proteger credenciales en Android
  y confirmó después ampliar el alcance a Datos personales (`/perfil/editar`).
  `CredentialScreenProtection` espera la activación de `FLAG_SECURE` antes de
  renderizar campos; mantiene protección en segundo plano y la libera por foco.
  Incluye todos los formularios de `AuthLayout`, cambios de correo/contraseña y
  eliminación de cuenta con OTP y la lectura/edición de teléfono y domicilio.
  Perfil general y catálogo permiten capturas.
  `PasswordField` oculta contraseñas visibles al perder actividad. Detalles en
  [AUTHENTICATION.md](./AUTHENTICATION.md#privacidad-de-credenciales-en-android).
- **Hallazgo 3, política sustituida con autorización:** se retiró el pinning y
  su bloqueo por respaldo. Se usa HTTPS con CA del sistema y hostname validado,
  siguiendo la política vigente anterior en este documento. La decisión evita
  depender de una clave futura de Render no controlada por CEMYDI, a cambio de
  renunciar a la restricción adicional ante una CA del sistema comprometida.
  Falta aceptación TLS en Android físico con la nueva build.
- **Hallazgo 4:** Android adopta confianza TLS del sistema en lugar de pinning;
  ya no se exige simetría de pins con iOS. La validación nativa de iOS y su cortina
  de privacidad siguen fuera del alcance Android y pendientes antes de distribuir allí.
- **Hallazgo 5, límite conocido:** se conserva la detección disuasoria de root;
  no se trata como autorización ni como resistencia garantizada frente a Magisk o
  Frida. La autorización crítica continúa en backend. No se inventó un endpoint
  de atestación ni se introdujo Play Integrity sin diseño de servidor.

La dependencia nativa añadida es `expo-screen-capture` ~57.0.4, instalada con
`npx expo install` para Expo 57.0.31 / React Native 0.86.3. Se bloqueó además
`READ_MEDIA_IMAGES` en `app.json`; no se solicitan permisos de fotos/disco.
El bloqueo por claves sigue la
[API oficial de Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/screen-capture/).
Requiere un APK nuevo, no una actualización JavaScript sobre el APK anterior.

Registro anterior a la sustitución de pinning: la generación CNG se comprobó en un proyecto aislado bajo
`test-results/security/remediation-cng/project`, conservando el `android/` local
anterior. Verificó las exclusiones de permisos y la comprobación nativa de Release
sin respaldo. No se compiló ni instaló un nuevo APK; `adb devices -l` no mostró
dispositivos. Quedan pendientes captura/grabación/multitarea en cada formulario,
retorno de Ayuda a login y navegación de credenciales a catálogo (capturas
permitidas), incluyendo contraseñas visibles y OTP. Comprobar también el retorno
con una cuenta desactivada y confirmar que desaparece la sesión.

La política del hallazgo 3 cambió con autorización; no queda pendiente un pin de
respaldo. La aceptación Android de captura y TLS sigue pendiente y no se acredita
por pruebas simuladas o generación CNG.

Validación inicial de estas correcciones, anterior al cambio de política TLS: `npm run lint`, `npm run typecheck` y
`npm run format:check` aprobados; `npm run test:release-security`, 10 pruebas
aprobadas. La suite completa aprobó 102 suites y 609 pruebas; resultados en
`test-results/security/remediation-jest.json` y `.log`. Después se añadió la prueba
específica de segundo plano y se ejecutó la suite de protección: sus siete casos
aprobaron. La ejecución completa registró avisos de `act` en las suites de catálogo
y favoritos, sin fallos; esas suites no fueron modificadas para estas correcciones.
Estos resultados no acreditan compilación ni aceptación nativa del APK corregido.

### Validación del cambio a TLS del sistema — 8 de noviembre de 2026

- Suite móvil completa: 107 suites, 675 pruebas aprobadas. Evidencia:
  `test-results/security/system-tls-jest.json` y `.log`.
- Lint, TypeScript, formato y `git diff --check` aprobados.
- Diez pruebas de seguridad y una prueba CNG con Expo 57: política main/debug,
  firma y migración desde los bloques antiguos aprobadas. El comando
  `npm run test:release-security` incluye ambas suites.
- Configuración efectiva de Expo production resuelta con HTTPS y FCM, sin pins.
- Diagnóstico TLS del backend aprobado desde Node; no sustituye a Android.
- `adb devices` no detectó dispositivos. No se compiló ni instaló APK ni se
  ejecutaron pruebas TLS/MitM o recepción push en Android físico en este cambio.
