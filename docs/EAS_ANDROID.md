# Liberación continua de Android con EAS

La Actividad 5 usa `develop` para generar candidatos Android de distribución interna. `main` sigue siendo la rama predeterminada de GitHub. El flujo de liberación se inicia manualmente y termina en EAS Build.

## Configuración auditada

| Perfil        | Entorno EAS   | Salida prevista                                             |
| ------------- | ------------- | ----------------------------------------------------------- |
| `development` | `development` | Build interno con Expo Dev Client.                          |
| `preview`     | `preview`     | APK Android release, distribución interna, bundle incluido. |
| `production`  | `production`  | AAB Android para tienda, con `autoIncrement`.               |

`preview` usa EAS CLI 25.3.0, Node 24.11.0 y la imagen Android `ubuntu-26.04-jdk-17-ndk-r27b-sdk-57`. `cli.appVersionSource` es `local`; la versión y el `versionCode` del candidato provienen de `app.json`. El paquete es `com.cemydi.app` y EAS usa la credencial Android remota existente. `app.json` enlaza el proyecto `@victor_valdivia/cemydi-mobile` mediante `extra.eas.projectId`.

En EAS CLI 25.3.0, las variables de `build.preview.env` tienen prioridad sobre nombres iguales en Expo. La consulta del entorno `preview` confirmó que los tres valores duplicados coinciden y que la cuenta carece de variables adicionales en ese entorno. El checkout de CI excluye los archivos `.env` locales por `.gitignore` y el job desactiva su carga mediante `EXPO_NO_DOTENV=1`.

| Variable                           | Valor efectivo o fuente                                                                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_APP_ENV`              | `production`, fijado por el perfil para pasar la guarda de release de `src/config/env.ts`.                                                                 |
| `EXPO_PUBLIC_API_URL`              | Origen HTTPS fijado en el perfil, coincide con Expo y `config/android-api.json`. `GET /products?page=1&pageSize=10` respondió HTTP 200 con validación TLS. |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | ID OAuth público fijado en el perfil, coincide con Expo.                                                                                                   |
| `EXPO_PUBLIC_WEBSITE_URL`          | Origen HTTPS para enlaces legales definido en Expo `preview`.                                                                                              |
| `GOOGLE_SERVICES_JSON`             | Archivo FCM definido en Expo `preview`; `app.config.js` consume la ruta del archivo.                                                                       |
| `EXPO_PUBLIC_EAS_PROJECT_ID`       | Override opcional de `app.config.js`. El flujo usa el UUID ya versionado en `app.json`.                                                                    |

Los valores `EXPO_PUBLIC_*` se incluyen en el cliente. Mantener `EXPO_TOKEN` en GitHub, el keystore de firma en EAS y la configuración FCM en su variable File. Para Google Sign-In, el cliente OAuth Android debe reconocer el SHA-1 del certificado de firma de `com.cemydi.app`.

## Habilitar y ejecutar el pipeline

1. Integrar los workflows revisados en `develop` y en `main`. GitHub requiere que `android-preview.yml` exista en la rama predeterminada para registrar `workflow_dispatch`. La ejecución selecciona `develop`.
2. En **Settings → Environments**, crear `android-preview`, permitir despliegues solo desde la rama `develop` y guardar `EXPO_TOKEN` exclusivamente como secreto de ese entorno. Usar un token Expo con el mínimo permiso necesario para compilar el proyecto existente. El workflow entrega el token al paso de EAS después de pasar las validaciones.
3. Revisar el acceso de descarga en Expo antes de ejecutar. La distribución interna permite por defecto instalar a quien tenga el enlace. Para exigir inicio de sesión con una cuenta autorizada, desactivar **Unauthenticated access to internal builds** en la configuración del proyecto.
4. Abrir **Actions → Android Preview → Run workflow**, elegir `develop` e iniciar. También se puede ejecutar `gh workflow run android-preview.yml --ref develop`.
5. Quality ejecuta TypeScript, política de seguridad Android, lint, formato y Expo Doctor. Tests ejecuta Jest unitario e integración y las comprobaciones de infraestructura y flujos Maestro. El candidato omite el APK debug de CI porque su salida se genera en EAS.
6. Después de aprobar Quality y Tests, el job ejecuta el comando siguiente y espera el resultado. `--freeze-credentials` protege la firma existente durante la ejecución no interactiva. El resumen registra SHA e ID de EAS cuando recibe un APK `FINISHED` para ese commit.

```bash
eas build --platform android --profile preview --non-interactive --freeze-credentials --wait --json
```

Si falta acceso al proyecto o al keystore, revisar la configuración con el responsable de Expo. Si la espera en GitHub vence, consultar el estado del build en EAS antes de reintentar. El trabajo remoto puede seguir en cola o en ejecución.

## Verificar y distribuir el APK

Localizar el ID del resumen en el proyecto Expo y comprobar plataforma Android, perfil `preview`, distribución interna, SHA y estado `Finished`. Descargar el APK y verificarlo con Android SDK Build Tools y ADB.

```powershell
Get-FileHash -Algorithm SHA256 .\cemydi-preview.apk
apkanalyzer manifest application-id .\cemydi-preview.apk
apksigner verify --verbose --print-certs .\cemydi-preview.apk
adb devices
adb install -r .\cemydi-preview.apk
adb shell am start -n com.cemydi.app/.MainActivity
```

Confirmar el paquete `com.cemydi.app`, comparar la huella con el certificado de firma aprobado y comprobar el arranque con Metro cerrado y sin `adb reverse` al puerto de Metro. Si Android rechaza la actualización por una diferencia de firma, usar un dispositivo limpio de QA. Validar catálogo y recuperación de conectividad, además de login, Google y notificaciones con una cuenta de prueba cuando corresponda.

Distribuir desde la ficha del build en Expo a los testers autorizados. El workflow registra el ID y mantiene el binario en EAS, sin ejecutar Submit, Google Play ni EAS Update.

Registrar SHA, ID de EAS, estado final, SHA-256 del APK y huella del certificado, dispositivo/OS y resultados de instalación y arranque. Para acreditar CD, asociar también la ejecución manual de GitHub al mismo ID de EAS.

[Configuración EAS](https://docs.expo.dev/eas/json/) · [Variables EAS](https://docs.expo.dev/eas/environment-variables/usage/) · [Build desde CI](https://docs.expo.dev/build/building-on-ci/) · [Distribución interna](https://docs.expo.dev/build/internal-distribution/) · [Ejecución manual en GitHub](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
