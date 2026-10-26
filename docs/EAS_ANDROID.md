# APK Android de pruebas internas con EAS

## Estado de esta preparación — 25 de octubre de 2026

Configuración local preparada; no se ejecutó ningún build, publicación, vinculación remota ni operación de firma. La instalación y la ejecución sin Metro siguen pendientes de un APK real.

Diagnóstico inicial: rama `feature/cart-rentals`, HEAD `6a309b6`, con cambios locales previos en documentación, pruebas y código. Se conservaron. No existían `eas.json` ni `.easignore`; EAS utiliza las exclusiones de `.gitignore`. Existe `android/` local generado e ignorado, aunque la documentación de arquitectura indica que no existe: no se modificó ni se enviará al builder. No hay `ios/` ni `credentials.json` local. La configuración local de Gradle usa la firma debug de la plantilla incluso para release; esto no demuestra que exista una firma remota y no se reutiliza en EAS mediante CNG.

Versiones inspeccionadas: Expo 57.0.31, React Native 0.86.3, Expo Dev Client 57.0.20, Node 24.11.0 y npm 11.12.1. `package-lock.json` usa lockfile v3 y sus dependencias raíz coinciden con `package.json`; sus URLs de resolución son del registro público npm. No se actualizaron dependencias ni lockfile. Los módulos Google Sign-In/Nitro y Speech Recognition están instalados; los Gradle revisados usan repositorios públicos, sin credenciales privadas observadas. No se verificó su descarga desde el builder.

## Cambio y motivo

El único archivo de configuración nuevo es `eas.json`; este documento registra el procedimiento específico y sus límites. Se conservan `app.json`, `app.config.js`, plugins, scripts, autenticación, UI y workflows Quality/Tests.

| Perfil        | Propósito                      | Configuración relevante                                                                               |
| ------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `development` | Desarrollo con Expo Dev Client | `developmentClient: true`, `distribution: internal`, entorno EAS `development`                        |
| `preview`     | APK instalable de pruebas      | `developmentClient: false`, `distribution: internal`, `android.buildType: apk`, entorno EAS `preview` |
| `production`  | Reserva para definir después   | Objeto vacío; no ejecutarlo en esta actividad                                                         |

`production` es un perfil válido con los valores por defecto de EAS; no es un bloqueo técnico. Todos los comandos de esta actividad deben seleccionar `--profile preview` explícitamente.

Se fija EAS CLI 25.3.0, Node 24.11.0 y la imagen Android `ubuntu-26.04-jdk-17-ndk-r27b-sdk-57` para development/preview. Node coincide con el entorno local y satisface el engine declarado por RN (`^24.3.0` entre las opciones admitidas). La imagen corresponde a SDK 57 y Java 17; su nombre evita el alias móvil `latest`, aunque Expo puede aplicar actualizaciones menores a la imagen. CLI y dependencias fijadas reducen variaciones; no se promete reproducibilidad binaria idéntica.

`cli.appVersionSource: local` conserva las versiones locales sin contador remoto ni autoIncrement. No hay `submit`, canales de EAS Update, sufijos de package ni overrides de Gradle. El package sigue siendo `com.cemydi.app`. La firma usa la fuente remota predeterminada de EAS: aún hay que confirmar que exista una credencial aprobada.

`preview` genera una variante release con el bundle JavaScript incluido; `development` es el perfil que usa Metro durante el desarrollo. El script `npm run android` invoca `expo run:android` y no sustituye este proceso EAS. No hay hooks `eas-build-*` en `package.json`; `prepare` ejecuta Husky. Quality y Tests siguen usando Node 22 y no se detectó un impedimento que exija modificarlos.

## Variables y requisitos pendientes

El entorno EAS `preview` y `EXPO_PUBLIC_APP_ENV` tienen propósitos distintos. `src/config/env.ts` rechaza **cualquier release** si `EXPO_PUBLIC_APP_ENV` no es `production`. Por eso el perfil fija ese valor público ya existente; no se modificó la validación ni se ejecutará el perfil EAS `production`. La URL determina qué backend se consume: debe ser el de pruebas autorizado, con datos de prueba y HTTPS, nunca datos sensibles reales.

El `.env` local contiene una API HTTP privada y un entorno incompatible con release. Se inspeccionaron presencia y características sin copiar valores. No se modificó ni se cargará al builder: está ignorado. `.env.example` también ilustra desarrollo local y no configura el build remoto.

Antes del primer build, el responsable debe establecer en Expo, en el entorno **preview**, los valores aprobados:

| Variable existente                 | Uso y clasificación                                                                                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `EXPO_PUBLIC_API_URL`              | Obligatoria; URL pública HTTPS del backend de pruebas accesible desde el teléfono. No usar localhost, loopback, IP LAN ni la URL de ejemplo. No incluir usuario, contraseña ni claves en la URL. |
| `EXPO_PUBLIC_APP_ENV`              | Pública; el perfil fija `production` por la guarda release existente.                                                                                                                            |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | ID OAuth público aprobado; requerido para Google en Android. El valor local no se envía automáticamente.                                                                                         |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | ID OAuth público; requerido solo para iOS. No inventarlo para un build Android.                                                                                                                  |
| `EXPO_PUBLIC_EAS_PROJECT_ID`       | UUID público del proyecto EAS existente y aprobado; necesario para la vinculación dinámica y push. Debe coincidir localmente y en EAS.                                                           |
| `EXPO_PUBLIC_WEBSITE_URL`          | Opcional; origen HTTPS público aprobado para enlaces legales.                                                                                                                                    |
| `GOOGLE_SERVICES_JSON`             | Variable EAS de tipo File con el archivo Android/FCM aprobado; su ruta la consume `app.config.js`. No usar prefijo `EXPO_PUBLIC_` ni versionar el archivo.                                       |

Las variables `EXPO_PUBLIC_*` se incluyen en el cliente: usar visibilidad Plain text o Sensitive según política, nunca confiar en ellas como secretos. El archivo de Google es configuración nativa, no una clave privada de cuenta de servicio; gestionarlo como archivo restringido. Las claves privadas de FCM, credenciales del backend, tokens de acceso a Expo y contraseñas de firma no pertenecen al bundle ni a `eas.json`.

La configuración local efectiva no contiene `extra.eas.projectId` ni `android.googleServicesFile`. Google Android tiene configuración pública mínima local (`googleNativeConfigured: true`); esto no verifica OAuth ni su disponibilidad remota. No se consultó la cuenta remota: asociación, permisos, variables EAS, cuota y existencia de firma siguen sin comprobar.

El responsable debe confirmar un proyecto Expo existente con slug compatible, acceso de build y una firma Android ya aprobada. Registrar/verificar su SHA-1 para `com.cemydi.app` en Google Cloud Console es un requisito externo de Google Sign-In. No crear ni reemplazar keystores para resolver errores. Si falta proyecto o firma, detenerse y obtener autorización específica para esa operación; no ejecutar `eas init` como parte de este procedimiento.

Notifications conserva su plugin y canal `cemydi`; push requiere project ID, archivo FCM y credenciales de envío correctas en la infraestructura correspondiente. La ausencia de FCM puede dejar un APK compilable sin push operativo. SecureStore conserva su plugin y exclusión de backup; Speech Recognition conserva permisos y configuración. Google no se reconfigura. Confirmar todo en dispositivo tras el build.

## Verificaciones locales

Resultados de esta preparación:

- EAS CLI 25.3.0 ejecutó únicamente `--version`, mediante caché npm, sin añadirse a las dependencias del proyecto. npm mostró avisos de dependencias transitivas obsoletas del CLI; no se aplicaron actualizaciones.
- JSON y estructura de `eas.json` aprobados con `EasJsonSchema` de `@expo/eas-json` 25.3.0, incluido en ese CLI. Aserciones adicionales comprobaron APK, distribución interna, dev client desactivado, entorno preview, guarda release, ausencia de Submit y engine de Node compatible con RN.
- `expo config --type prebuild --json`: resolución correcta del package, plugins y seis referencias a assets existentes. Cabeceras PNG válidas: icono, adaptive foreground, monochrome y splash de 1024 × 1024; favicon de 48 × 48. No genera un proyecto nativo.
- `expo config --type introspect --json`: resolución correcta de mods Android de manifest, colores, estilos, strings y propiedades Gradle, incluidos plugins de SecureStore, Notifications y Speech Recognition. No ejecuta dangerous mods ni acredita una compilación Gradle.
- `npm run typecheck`: aprobado.
- `npm run lint`: aprobado.
- `npm run doctor`: 21/21 checks aprobados.
- `npm run format:check`: aprobado en todo el repositorio.
- `npm test -- --runInBand`: 66 suites y 364 pruebas aprobadas, en 97.906 segundos. Emitió advertencias de actualizaciones fuera de `act` en CatalogScreen y FavoritesScreen; no se ocultaron ni se modificaron las pruebas.
- `git diff --check`: aprobado para los cambios versionados existentes. Los dos archivos nuevos también se comprobaron con Prettier.

No se ejecutaron prebuild, Gradle, exportación de bundles ni build EAS. El plugin local `with-android-java.cjs` modifica wrappers mediante dangerous mod; la introspección no ejecuta ese código. `with-android-cmake.cjs` aplica rutas cortas solo en Windows y no interviene en el builder Linux. La resolución de plugins y Doctor no garantizan que estos mods, CMake/Nitro, la descarga Maven o la firma funcionen en un build real.

Si aparece un error de generación nativa, reproducirlo en una **copia desechable** del estado revisado, sin `.env`, credenciales, `android/`, `ios/`, `.tools/` ni `node_modules/`. En esa copia, instalar con `npm ci` y ejecutar `npx expo prebuild --platform android --no-install` con las variables públicas aprobadas. Revisar Gradle, manifest y wrappers generados; no ejecutar Gradle ni copiar esos resultados al árbol principal. No se realizó esa comprobación en esta tarea.

## Generación manual futura del APK

Estos comandos **no se ejecutaron**. Requieren autorización para lanzar el build remoto, configuración previa del entorno preview y firma existente. Ejecutarlos desde la raíz del repositorio después de revisar el diff y repetir las validaciones. EAS envía también cambios locales no confirmados: registrar qué estado exacto se incluye.

En PowerShell, establecer solo en la sesión el UUID aprobado del proyecto ya existente, sin sobrescribir `.env`:

```powershell
$env:EXPO_PUBLIC_EAS_PROJECT_ID = Read-Host 'UUID del proyecto EAS existente aprobado'
npx --yes eas-cli@25.3.0 whoami
npx --yes eas-cli@25.3.0 project:info
```

Si no hay sesión, el responsable puede iniciar sesión con `npx --yes eas-cli@25.3.0 login`. Confirmar que `project:info` corresponde a CEMYDI antes de continuar. No aceptar crear o vincular otro proyecto. Comprobar en Expo las variables del entorno preview y la firma existente, sin modificarla.

```powershell
npx --yes eas-cli@25.3.0 build --platform android --profile preview --non-interactive --freeze-credentials
```

`--freeze-credentials` impide actualizar credenciales en modo no interactivo; si faltan, resolver el requisito con el responsable, sin retirar esa protección. No añadir `--auto-submit`. Guardar URL/ID del build, log, versiones, perfil, package, commit y lista de cambios locales. Descargar el APK únicamente desde el resultado exitoso de ese build.

## Comprobar e instalar en Android

Con Android SDK Build Tools y ADB disponibles, renombrar la descarga a `cemydi-preview.apk` en la carpeta de trabajo y ejecutar allí:

```powershell
Get-FileHash -Algorithm SHA256 .\cemydi-preview.apk
apkanalyzer manifest application-id .\cemydi-preview.apk
apksigner verify --verbose --print-certs .\cemydi-preview.apk
adb devices
adb install -r .\cemydi-preview.apk
adb shell am force-stop com.cemydi.app
adb shell monkey -p com.cemydi.app -c android.intent.category.LAUNCHER 1
```

Comprobar `com.cemydi.app`, firma y dispositivo autorizado. Si hay varios dispositivos, añadir `-s` con el serial aprobado a cada comando ADB. Si la firma instalada difiere, Android rechazará la actualización; no desinstalar automáticamente porque borraría los datos locales. Este APK comparte identificador con development, por lo que no se instala como una app separada.

Cerrar el proceso Metro del proyecto y quitar cualquier conexión ADB reverse a su puerto antes de abrir. La app debe arrancar y navegar sin el launcher de Dev Client ni pedir un servidor JavaScript. Mantener internet para probar la API HTTPS: no depender de Metro no significa que el backend funcione offline. Repetir arranque en modo avión para observar el manejo de errores/conectividad, sin exigir datos remotos.

Verificar catálogo, detalle, login con cuenta de prueba, restauración de sesión/SecureStore, Google con la firma aprobada, permisos y búsqueda por voz, notificaciones y recuperación de conectividad. Registrar fallos sin asumir éxito por haber instalado. Los flows Maestro actuales usan el development build y una API pública ficticia; no certifican este APK preview sin adaptación y validación separadas.

## Evidencia para la Actividad 4

Capturar rama/commit y diff revisado; los tres perfiles de `eas.json`; salidas y exit codes de validaciones, con los fallos de formato y advertencias si existen. En una ejecución futura, añadir pantalla/log EAS con perfil preview, plataforma Android, estado final e ID/URL; versiones del builder y dependencias; APK descargado con checksum, package y certificado sin credenciales privadas.

Grabar instalación y primer arranque con Metro cerrado, modelo/versión Android y navegación; añadir pruebas con/sin internet y resultados de módulos nativos. Usar cuentas y datos de prueba. Ocultar correos personales, tokens, credenciales, contenido del archivo Google y datos de usuarios. Separar evidencia local de la evidencia del build real y de aceptación: estas dos últimas siguen pendientes.

Referencias consultadas: [configuración EAS](https://docs.expo.dev/eas/json/), [APK Android](https://docs.expo.dev/build-reference/apk/), [infraestructura SDK 57](https://docs.expo.dev/build-reference/infrastructure/), [variables EAS](https://docs.expo.dev/eas/environment-variables/) y [CLI y freeze-credentials](https://docs.expo.dev/eas/cli/).
