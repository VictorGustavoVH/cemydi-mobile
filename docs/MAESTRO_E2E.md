# Maestro E2E en Android — Windows 11

## Pipeline Android en GitHub Actions

`.github/workflows/tests.yml` conserva la matriz Jest y encadena mediante `needs`:

```text
changes + tests (unit/integration) + maestro_checks
                   → build_android (si requerido) → maestro (si requerido) → e2e
```

El check final `e2e` también depende directamente de todas las etapas de Tests.
Exige éxito en selección y checks rápidos; solo acepta build/Maestro omitidos cuando
`changes` declara Android opcional. Si Android es requerido, ambos deben aprobar.
Fallos, cancelaciones y omisiones inesperadas siguen bloqueando. `quality.yml` se mantiene con el job `validate`
original y se ejecuta de forma independiente. Ambos workflows se ejecutan en PR y
push de `develop`/`main`; Tests permite además ejecución manual. `needs` no cruza
workflows: la protección de ramas debe exigir tanto `validate` como `e2e`.

La selección de `scripts/ci/android-policy.cjs` usa el diff acumulado del PR contra
su base, o `before`/SHA en push, e incluye archivos eliminados y las dos rutas de
renombrados. Documentación, tests/fixtures Jest y herramientas de carga/rendimiento
ajenas a Maestro omiten Android. Código de app, assets, dependencias, configuración,
plugins, `.maestro`, su API ficticia y scripts CI lo requieren. Las rutas desconocidas
también lo requieren. Un diff inválido falla; no habilita una omisión silenciosa.
`workflow_dispatch` y la etiqueta de PR `ci:android` fuerzan los cinco flujos,
incluida la validación explícita de una versión. Detalles y excepciones en
[TESTING.md](./TESTING.md).

El build genera Android con CNG desde el checkout de la ejecución, sin versionar
archivos nativos ni usar EAS. Compila un APK debug Development Build para `x86_64`
con Java 21. El job Maestro descarga ese artefacto y verifica su SHA-256; no reutiliza
el APK arm64 del teléfono documentado abajo. Maestro queda fijado a 2.11.0 con
checksum del release oficial. No requiere secretos ni un teléfono conectado.

`scripts/maestro-ci.sh` solo admite el runner GitHub-hosted y `emulator-5554` con
propiedad QEMU activa. El workflow crea ese emulador nuevo y desechable (Android
API 35, AOSP `aosp_atd`, Pixel 6, `x86_64`, 2 cores/3072 MB y 720×1600 a 320 dpi);
ejecutar este pipeline autoriza la instalación
y limpieza de `com.cemydi.app` exclusivamente allí. El script configura las dos
variables de dispositivo/limpieza y llama a `npm run test:e2e`, conservando las
protecciones locales, los cinco flujos, Metro y la API ficticia. La autorización
del emulador de CI no se extiende a dispositivos físicos ni emuladores locales.

Las evidencias se suben incluso si falla una etapa: diagnósticos de build por 14
días, APK/checksum por 7 días y evidencias Maestro/logcat por 14 días. El script
conserva el código de error de instalación o E2E aunque no consiga recoger logcat.
Los fallos de preflight pueden no generar JUnit ni `run.json`; revisar también el
log del job. No se omiten fallos ni se añaden reintentos automáticos.

Antes de instalar el APK se espera a las colas normal y de fondo de Package
Manager, con timeout de 60 s cada una. No basta `sys.boot_completed` para terminar
la preparación inicial del OS. Se guarda el último ANR antes y después de la suite.
Metro usa un único worker y modo headless de Expo 57 para evitar la instalación y
ejecución automática de Electron DevTools en el runner sin escritorio.

`scripts/ci/prepare-kvm.cjs` corre antes de instalar Java, Maestro y dependencias.
Registra nodo, modo, propietario y acceso a `/dev/kvm` en `ci/kvm.json`, incluso
cuando falla. Solo si encuentra un dispositivo de caracteres sin acceso concede
lectura/escritura con `sudo -n chmod a+rw /dev/kvm` y verifica el resultado de forma
síncrona. Si el nodo no existe o el permiso no se puede corregir, falla. No depende
de reglas udev pendientes ni arranca con `-accel off`: el emulador exige `-accel on`.

Validación sin dispositivo:

```bash
npm run test:e2e -- --check
node --test scripts/maestro-infra.test.cjs scripts/maestro-ci.test.cjs
node --test scripts/ci/android-policy.test.cjs scripts/ci/prepare-kvm.test.cjs
bash -n scripts/maestro-ci.sh
actionlint .github/workflows/quality.yml .github/workflows/tests.yml
```

Las pruebas del script simulan ADB y npm: verifican rechazo de entornos/seriales
ajenos, rechazo de dispositivos no emulados, propagación de fallos y recolección de
evidencias. Las pruebas de política cubren selección, renombrados/borrados, diff
inválido, ejecución manual, fallos/cancelaciones y omisiones legítimas o inesperadas.
Las de KVM simulan el estado del nodo y la concesión de permisos; no usan KVM local
ni ADB. No ejecutan la app. La revisión necesita publicarse y aprobar los cinco
flujos nativos en GitHub; no confundir estos tests con una ejecución E2E aprobada.
Después, añadir el check `e2e` a los checks obligatorios en `develop` y `main` según
[GIT_WORKFLOW.md](./GIT_WORKFLOW.md). Detalles del pipeline en
[TESTING.md](./TESTING.md).

Referencias: [CNG de Expo](https://docs.expo.dev/workflow/continuous-native-generation/),
[emulador en Actions](https://github.com/ReactiveCircus/android-emulator-runner),
[release Maestro 2.11.0](https://github.com/mobile-dev-inc/Maestro/releases/tag/cli-2.11.0)
y [`needs` de GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idneeds).

## SIGSEGV tras integrar el PR 148 — 26 de octubre de 2026

Se compararon exclusivamente estas ejecuciones y sus artefactos Maestro originales:

| Run                                                                                      | Evento y revisión probada                                                   | Resultado |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------- |
| [40387567541](https://github.com/VictorGustavoVH/cemydi-mobile/actions/runs/40387567541) | PR, merge temporal `7503697435d0aab2083dbf118bb987ecb50856ca`               | 5/5       |
| [40390831973](https://github.com/VictorGustavoVH/cemydi-mobile/actions/runs/40390831973) | push a develop, `3cccf45bc9304dd02a63f15ae4febcb408431ac5`                  | 3/5       |
| [40390841004](https://github.com/VictorGustavoVH/cemydi-mobile/actions/runs/40390841004) | PR desde develop, merge temporal `dc93d5f7fce751f11e8f4eedfbc7db7eb4690cb0` | 0/5       |

El merge temporal aprobado y el merge final de develop comparten el árbol
`e3a9518f6ce2ea525a72a8bb7b0f70d15928258a`. El otro merge temporal solo cambia
`.prettierrc` (`endOfLine: auto`). No hay cambios funcionales de app, lockfile,
selectores ni scripts entre estos estados.

Los tres jobs usan Ubuntu 24.04 (imagen 20261012.334.1), Node 22.23.3, Temurin 21.0.12, Maestro 2.11.0,
emulador 37.2.12.0/build 16428233, Android 35 `aosp_atd` x86_64, Pixel 6,
2 cores/3072 MB y resolución 720×1600/densidad 320. KVM y checksum del APK
aprobaron; `lastanr-before.txt` y `lastanr-after.txt` no registran ANR.

En los tres casos `Connect` aparece y `openLink` termina. La URL de Dev Client y
la espera de 120000 ms para `Omitir introducción y explorar catálogo` son iguales.
El selector coincide con el accessibility label del botón existente y funciona en
los cinco flujos de referencia y en tres del push posterior. No se cambia el
selector ni se aumenta su timeout.

### Evidencia causal

Los `logs/device-logcat.txt` por flujo conservan los crashes que el buffer final
de logcat puede perder. Las horas siguientes son UTC, tal como aparecen en ellos:

- PR fallido: 20:09:00.889, SIGSEGV en `mqt_v_js`, PID 2192. Backtrace en
  `MountingCoordinator::pullTransaction(bool) const+706`.
- Push, carrito: 20:10:41.489, SIGSEGV en `mqt_v_js`, PID 2208. PC en heap Scudo,
  llamado desde `MountingCoordinator::pullTransaction(bool) const+713`.
- Push, pestañas: 20:14:10.830, SIGSEGV en `mqt_v_js`, PID 3199. Mismo punto
  `pullTransaction+713`, PC en heap Scudo.

Los backtraces identifican el mismo `libreactnative.so`, BuildId
`0ee9df273e73129b6847c18499325cfe1dd7dfd3`, y Fabric finalizando una transacción de
montaje. Metro ya compiló el bundle (19.486 s y 20.920 s en los runs fallidos) y
Android registra `Running "main"` antes de terminar el proceso. La referencia
aprobada tarda más en compilar el primer bundle (37.388 s), sin crash. Las capturas de
fallo quedan negras, sin el botón en la jerarquía. La espera agotada es una
consecuencia del crash, no prueba de un servidor lento ni de un selector incorrecto.

En el run 0/5, el siguiente flujo registra además `DeviceServerDiedException` y
`device offline`; los demás fallan inmediatamente y faltan los listeners ADB al
limpiar. Esa pérdida posterior es otro fallo de infraestructura; no se atribuye
su causa exacta al SIGSEGV sin evidencia adicional. En el run 3/5 ADB se mantiene
operativo y la limpieza no registra errores. `unexpected: []` en ambos descarta
peticiones rechazadas por el fixture, pero no prueba por sí solo toda la conectividad.
Las rutas ficticias sí se ejercitan en los tres escenarios aprobados del push.

### Corrección nativa acotada

El lockfile instala `react-native-screens` 4.26.2. Su `ScreensModule.initialize()`
registra el listener de lifecycle y llama `setupFabric()`; `onHostResume()` también
lo llama. En `NativeProxy::nativeAddMutationsListener` la inicialización de
`screenRemovalListener_` no está sincronizada. El mutex existente solo protege
la lista de coordinadores, no esa inicialización.

El [PR upstream 4413](https://github.com/software-mansion/react-native-screens/pull/4413)
describe y corrige esa carrera y las mismas firmas de crash. Esta coincidencia y
el código vulnerable instalado respaldan el backport; los logs de CEMYDI no
instrumentan ambas asignaciones concurrentes, por lo que la validación nativa de
la corrección continúa pendiente.

`plugins/with-android-screens-lifetime.cjs` aplica durante prebuild Android los
cuatro archivos revisados de ese fix, conservados en
`plugins/react-native-screens-4.26.2/` con licencia, referencia y hashes.
El listener pasa a singleton con inicialización segura; el callback captura la
referencia JNI por valor y se instala/retira con mutex y token de propietario.
No cambia dependencias, UI, escenarios, esperas ni configuración del emulador.
No se editan proyectos Android generados. iOS no aplica este mod.

Se exige versión 4.26.2 y hashes de entrada/salida conocidos. Una fuente o versión
distinta falla antes de escribir: al actualizar Screens, revisar y retirar el
backport cuando la distribución instalada contenga el fix. No omitir esa guarda.
El plugin admite repetir prebuild y normaliza CRLF para calcular hashes.
`scripts/ci/screens-lifetime.test.cjs` prueba aplicación completa, idempotencia,
rechazo de fuentes/versiones desconocidas y reemplazos alterados. Estos tests
operan sobre copias temporales; no ejecutan CNG, Gradle, ADB ni Maestro.

Las copias nuevas de evidencias están bajo
`test-results/ci/run-40390831973/maestro-analysis/` y
`test-results/ci/run-40390841004/maestro-analysis/`. Sus ZIP tienen SHA-256
`97af2d2014c94df6f02bf8e772839ddb8653f161dd49764ca289a67c14262bf8` y
`cfa785053b2d8ffbb0b5be75a8b42d835ca7ef96710178406899eccba4b9d868`,
respectivamente, coincidentes con GitHub. No se sobrescribieron resultados anteriores.

### Validación pendiente en GitHub

Tras publicar el cambio con autorización, ejecutar Tests con Android requerido
(cambio en plugin/workflow o `workflow_dispatch`). Debe generar un APK nuevo con
las cuatro fuentes corregidas, verificar checksum y completar 5/5 flujos sin
fallos/omitidos, SIGSEGV de CEMYDI, pérdida del servidor Maestro, peticiones
inesperadas ni errores de limpieza. Conservar JUnit, logs por flujo y logcat.
Una segunda ejecución completa sobre develop ayuda a comprobar la estabilidad
del arranque intermitente; no equivale a un reintento que oculte un fallo.
No declarar resuelto por tests Node, Jest o un único arranque local.

## PR 149: pérdida de ADB después del backport — 26 de octubre de 2026

Se inspeccionó el [run 40400406577](https://github.com/VictorGustavoVH/cemydi-mobile/actions/runs/40400406577)
del [PR 149](https://github.com/VictorGustavoVH/cemydi-mobile/pull/149), head
`8c4a219038d6efaccd452f1424fa560e71920bea`, merge probado
`564833fac5b1e6f179242a95206ca997cc5d3659`. Quality, Jest, infraestructura y build
aprobaron; Maestro terminó 0/5 y e2e propagó el fallo.

### Backport realmente compilado

El log original del job build_android registra:

```text
21:01:17.529 Screens 4.26.2: lifetime corregido (4 fuentes aplicadas).
21:05:32.536 > Task :react-native-screens:configureCMakeDebug[x86_64]
21:05:47.136 > Task :react-native-screens:buildCMakeDebug[x86_64]
21:07:50.935 BUILD SUCCESSFUL in 6m 31s
```

Se descargó el artefacto APK 12687969054 de ese mismo run, se verificó el checksum
del APK contra `app-debug.apk.sha256` y se extrajo únicamente `lib/x86_64/librnscreens.so`
para inspección ELF con `llvm-readelf --dyn-syms --demangle`. Contiene
`RNSScreenRemovalListener::setListener` y `RNSScreenRemovalListener::clearListener`,
funciones añadidas por el backport y ausentes en la fuente anterior. Esto verifica
su llegada al binario, además de la ejecución del plugin.

| Archivo                            | SHA-256 comprobado                                                 |
| ---------------------------------- | ------------------------------------------------------------------ |
| ZIP Maestro, artefacto 12689429086 | `92022eda2d9fc5913c01e4152aefcfeb4f8aabbbd77983876f61b1184c94d723` |
| ZIP APK, artefacto 12687969054     | `1a7526771ca6a4400d61dfa8a8e955473e2526cb11253d2daff942e4c32fefed` |
| APK contenido                      | `f3cdfcb9faa48da315d5a417172ad2d931a82ba29f41cd27b08463eee01f040b` |
| librnscreens.so contenido          | `54cb4a77e4374a548a24f0d8842921bd301121ae6dbb83663fea183f1571210f` |

Los cuatro destinos CNG, relativos al paquete `node_modules/react-native-screens`,
son `android/src/main/cpp/NativeProxy.cpp`, `android/src/main/cpp/NativeProxy.h`,
`cpp/RNSScreenRemovalListener.cpp` y `cpp/RNSScreenRemovalListener.h`.
El manifiesto versionado contiene sus hashes previos y corregidos; el plugin
rechaza fuentes distintas antes de escribir. Este run solo imprime el conteo de
fuentes: no conserva una lectura posterior con sus hashes individuales. La
inspección ELF acredita el backport compilado, pero no sustituye ese comprobante
de fuentes. La revisión de diagnóstico añade dicha lectura posterior y la guarda
en `test-results/android/screens-backport.json`, junto con rutas, versión y commit
original. También imprime cada hash; cualquier diferencia falla CNG.

### Secuencia observada, horas UTC

```text
21:10:21.812 I/ReactNativeJS: Running "main" ... "fabric":true
21:10:23.316 I/adbd: host-17: connection terminated: write failed
21:10:23.316 I/adbd: host-17: offline
21:10:23.317 I/adbd: destroying transport host-17
21:10:23.378 E/AndroidRuntime: FATAL EXCEPTION: OkHttp TaskRunner
21:10:23.378 E/AndroidRuntime: java.lang.IllegalStateException: closed
```

La excepción Java pasa por `okio.RealBufferedSink`, `DeflaterSink`,
`okhttp3.internal.ws.MessageDeflater`, `WebSocketWriter` y `RealWebSocket`.
Dev Launcher la intercepta y abre `DevLauncherErrorActivity`. No es una excepción
JavaScript ni el backtrace Fabric observado antes del backport.

El primer escenario termina en `DeviceServerDiedException` durante `viewHierarchy`,
con `UNAVAILABLE` y `device offline`. El segundo falla al iniciar. ADB vuelve a
aceptar comandos en los siguientes, pero la jerarquía de los tres fallos restantes
contiene el error de Dev Client:

```text
There was a problem loading the project.
java.net.ConnectException: Failed to connect to /127.0.0.1:8091
connect failed: ECONNREFUSED (Connection refused)
```

`run.json` conserva salida 1, `unexpected: []` y errores de limpieza por ausencia
de ambos listeners, `tcp:4198` y `tcp:8091`. La pérdida de transporte precede a la
excepción Java y explica la desconexión de Maestro; la falta de túneles explica
el rechazo de conexión a Metro en los siguientes flujos. La evidencia disponible
no determina qué provocó el corte inicial de ADB ni prueba que la excepción de
OkHttp sea exclusivamente consecuencia de este.

Metro compiló el primer bundle en 21.693 s. Se confirma entrada a `main`, pero no
que la introducción haya quedado renderizada y accesible antes del corte: el
primer flujo no completó la espera del botón. Las capturas de fallo están negras;
la jerarquía sí conserva el error de conexión de Dev Client. No confundir una
captura negra con un nuevo crash Fabric. No hay ANR antes o después.

Se buscaron `SIGSEGV`, `Fatal signal` y `MountingCoordinator::pullTransaction` en
todos los logs de texto disponibles del artefacto, sin coincidencias. Tampoco se
encontraron errores `ReactNativeJS`. Esto describe la evidencia capturada y no
demuestra ausencia universal de crashes fuera de su cobertura.

Comparación: 40387567541 aprobó 5/5 sin esas firmas; 40390831973 y 40390841004
sí contienen SIGSEGV de Fabric. Este último ya presentaba una pérdida posterior
de ADB. El run nuevo conserva un problema de transporte, con otra excepción, sin
evidencia de regresión del backport. La imagen ATD/API 35, emulador 37.2.12.0,
Maestro 2.11.0, selectores y esperas siguen iguales.

### Advertencias de overlay e hipótesis pendientes

Las advertencias `cmd overlay enable-exclusive` aparecen a las 21:09:46, antes de
iniciar los flujos. El comando incluye salida multilínea con separadores `---` y
nombres de paquetes; el shell informa `---: inaccessible or not found`. Se trata
de una selección de overlay mal formada en la preparación del emulador. Después
se instala la app, aparece `Connect`, se abre el deep link y se ejecuta JavaScript.
No hay evidencia causal que conecte esos avisos con el corte de transporte ocurrido
unos 36 s después. Son secundarios para el fallo acreditado; tampoco se certifica
que todos los ajustes visuales del emulador se hayan aplicado correctamente.
Las mismas dos advertencias también aparecen en 40387567541 (5/5), 40390831973
y 40390841004: su presencia no distingue el run nuevo del caso aprobado.

No se modifican el backport, los timeouts, los selectores ni el transporte de la
app para ocultar el resultado. La mejora aplicada es de trazabilidad CNG, no una
corrección del corte ADB. Las dos pruebas nuevas comprueban hashes posteriores y
rechazo de alteraciones. El resto de la infraestructura conserva sus criterios.

Para investigar el corte inicial en otra ejecución, conservar desde el arranque
el log del servidor ADB del host, estado del transporte, PID del servidor,
`adb reverse --list` y salud de Metro/API, correlacionados en el tiempo. No añadir
reconexiones/reintentos que conviertan esta ejecución fallida en aprobación.
Verificar el comprobante CNG, un APK nuevo y 5/5 escenarios sin errores nativos,
Java, transporte o limpieza antes de declarar resuelto el problema.

Las evidencias originales se conservan sin sobrescritura bajo
`test-results/ci/run-40400406577/maestro-analysis/` y `apk-analysis/`.
No se ejecutaron ADB, Maestro, CNG ni Gradle locales ni se usó el teléfono.

## Diagnóstico de GitHub Actions — 26 de octubre de 2026

Evidencia consultada: [run 40371511049](https://github.com/VictorGustavoVH/cemydi-mobile/actions/runs/40371511049)
y [log completo del job Maestro](https://github.com/VictorGustavoVH/cemydi-mobile/actions/runs/40371511049/job/121751103373).
El PR #147 estaba abierto y su head era `866b15d`; se probó el merge virtual
`6e173d2af12c9eeb9a16c4b89a2bff81b7cad19a`.

- `unit`, `integration`, `maestro_checks` y `build_android`: aprobados.
- Gradle compiló el APK `x86_64` en 11 min 45 s. El build descargó CMake 3.22.1
  además de 3.30.5; ahora ambas versiones se declaran en el paso SDK.
- El job Maestro descargó el APK y validó su checksum. Java Temurin 21.0.12 y la
  CLI Maestro 2.11.0 arrancaron correctamente. El runner era Ubuntu 24.04.5,
  imagen `20261012.334.1`.
- `Enable KVM` terminó con código 1 a las 18:00:25 UTC. El emulador quedó `skipped`:
  no se ejecutó ningún flujo nativo. La subida de evidencias no encontró archivos.
- `e2e` falló al detectar Maestro fallido; ese resultado era correcto.

El bloque ejecutaba escritura de regla udev, `udevadm control --reload-rules`,
`udevadm trigger --name-match=kvm` y `test -r /dev/kvm && test -w /dev/kvm`.
El log solo contiene el eco de la regla y la salida 1: no tiene trazas por comando,
stderr adicional, `stat` del nodo ni diagnóstico de permisos. **No permite comprobar
cuál de los comandos silenciosos devolvió 1**, ni distinguir nodo ausente, permisos
o una carrera al aplicar la regla. Atribuirlo a permisos o a udev sería una hipótesis,
no una causa raíz demostrada. Sí está probado que el fallo ocurrió en preparación
KVM, antes del emulador, y no en un escenario Maestro.

La revisión sustituye ese bloque opaco por inspección y concesión condicional
síncrona de acceso. No afirma resolver un problema de hardware desconocido. El
próximo run debe aportar `kvm.json` y completar la ejecución nativa: JUnit con los
cinco escenarios, sin fallos ni omitidos, y `run.json` con código 0, sin interrupción,
peticiones inesperadas ni errores de infraestructura/limpieza.

La combinación Ubuntu x64/API 35/Google APIs/`x86_64`/Java 21 se conserva: el build
y la CLI ya aprobaron, pero el arranque del AVD y los cinco flujos en esa imagen
siguen pendientes. GitHub documenta aceleración Android en sus runners Linux, y
[Android documenta los requisitos de KVM](https://developer.android.com/studio/run/emulator-acceleration).
Si un nuevo diagnóstico muestra que el runner no expone KVM, no se permite aprobar
sin E2E. Una alternativa es un runner GitHub-hosted Intel macOS compatible usando
el hipervisor de macOS en lugar del paso KVM, o un Linux dedicado con virtualización
habilitada y una política explícita para ese runner. Ambas requieren ajustar y
validar el entorno; no se cambia a ellas automáticamente ni se usa el teléfono.

## Segundo run: ANR de Pixel Launcher y pérdida de ADB

En el [run 40378701635 del PR #148](https://github.com/VictorGustavoVH/cemydi-mobile/actions/runs/40378701635),
Quality, Jest, infraestructura, selección y build aprobaron. `kvm.json` confirma
que el nodo existía con modo 660, sin acceso para el usuario del runner; la concesión
síncrona lo dejó en 666 con lectura/escritura. El emulador arrancó y el APK se instaló.

La captura `step-010-assertCondition-Connect.png` muestra **Pixel Launcher isn't
responding**, con Dev Launcher detrás. El diálogo del OS impide que Maestro vea
`Connect`. En los cuatro flujos siguientes, los logs registran
`DeviceServerDiedException`, `device offline` y finalmente dispositivo no encontrado.
JUnit informa cinco fallos, pero no demuestra cinco regresiones funcionales: el
primero fue una obstrucción del OS y los restantes no pudieron usar el dispositivo.
No hubo bundle JS servido ni peticiones inesperadas a la API ficticia.

Además, `metro.log` contiene un aborto SUID de Electron al instalar React Native
DevTools. El código del CLI Expo 57 instalado (`createDebugMiddleware.js` y
`utils/env.js`) confirma que `CI=1` por sí solo no desactiva ese proceso;
`EXPO_UNSTABLE_HEADLESS=1` sí impide habilitar el shell standalone.

Cambios de esta revisión:

- Imagen AOSP `default` en lugar de Google APIs: estos flujos no usan GMS ni Google
  Sign-In y no necesitan Pixel Launcher. Se comprobó la disponibilidad estable de
  `system-images;android-35;default;x86_64` en el catálogo oficial del SDK.
- Resolución reducida, RAM explícita, dos cores y un worker Metro para limitar la
  competencia de recursos. La presión exacta de CPU/memoria no quedó medida en el
  run fallido; se trata de una mitigación, no de una causa demostrada del ANR.
- Preparación de Package Manager con esperas acotadas y conservación de ANR.
- Metro headless sin relajar ni desactivar el sandbox de Electron.
- Preservación del fallo principal de Maestro y registro separado de cada fallo
  de limpieza. El mensaje `listener tcp:8091 not found` era posterior al fallo de
  los flujos; ya no sustituye su diagnóstico principal en `run.json`.

Se conserva la espera de `Connect`, las cinco aserciones funcionales, la limpieza
autorizada del emulador y el check final bloqueante. No se cierran diálogos ANR
automáticamente, no se reintentan tests ni se usa el teléfono. Hace falta un nuevo
run con cinco escenarios aprobados para validar la corrección; los tests locales
de infraestructura no acreditan ese resultado.

## Tercer run: Quickstep falla antes de instalar CEMYDI

En el [run 40384189949](https://github.com/VictorGustavoVH/cemydi-mobile/actions/runs/40384189949)
KVM, el APK y los checks rápidos aprobaron. Metro ya no registró el aborto de
Electron y ADB permaneció disponible: los cinco flujos pudieron intentar la misma
espera de `Connect` durante 30 segundos. Las capturas muestran el diálogo
**Quickstep isn't responding** bloqueando Dev Launcher.

`lastanr-before.txt` y `lastanr-after.txt` coinciden: el ANR ocurrió a las 19:22:55 UTC,
antes de instalar CEMYDI (19:22:58), con motivo
`Input dispatching timed out (Application does not have a focused window)`.
El job acababa de enviar `input keyevent 82` al completar `sys.boot_completed`.
La coincidencia temporal señala el arranque/foco del launcher; no acredita una
regresión de CEMYDI. La imagen AOSP normal también contiene Quickstep, de modo que
eliminar solo los servicios Google no resolvió el bloqueo.

La revisión cambia a `aosp_atd` API 35/x86_64, disponible en el canal estable del
[catálogo oficial SDK](https://dl.google.com/android/repository/sys-img/aosp_atd/sys-img2-3.xml).
[Android documenta](https://developer.android.com/studio/test/managed-devices#enable-atd)
que las imágenes ATD eliminan Quickstep, SystemUI y aplicaciones ajenas a pruebas.
Estos flujos de invitado no necesitan servicios Google, navegador ni launcher del OS;
siguen usando el Development Build de Expo y la app real, con imágenes renderizadas
por software. No son pruebas de fidelidad gráfica con aceleración hardware.

El preflight ahora rechaza cualquier ANR ya registrado por el emulador desechable
antes de instalar el APK. No cierra el diálogo ni lo ignora. El check `e2e` conserva
su política: cuando Android es requerido, Maestro debe aprobar los cinco escenarios.
La nueva imagen debe verificarse en un run nativo antes de considerar esto resuelto.

## Diagnóstico y alcance

La implementación previa ya proporcionaba wrapper Java, Metro local, ADB reverse,
API ficticia y cinco flujos. Se conserva esa infraestructura. Se revisaron Expo
instalado **57.0.31**, Maestro **2.11.0**, `app.json`, `app.config.js` y `eas.json`.
No hay referencias vigentes a Expo Go ni a `host.exp.exponent` en los flujos.

Problemas corregidos:

- El catálogo no verificaba productos ni búsqueda positiva ni el efecto del filtro.
- Detalle y carrito abrían `/producto/wheelchair`, un fixture local distinto de la API.
- `pm path` solo comprobaba instalación; también aceptaba APK Preview.
- Se elegía automáticamente un emulador y se borraban datos sin una autorización
  ligada al dispositivo. Ahora ambos pasos requieren variables explícitas.
- La API aceptaba filtros que ignoraba y respuestas de ids no existentes en
  recomendaciones/reseñas. Ahora rechaza lo ajeno al escenario y falla el runner.
- Los argumentos arbitrarios podían sobrescribir variables o seleccionar otros
  flujos. Ahora solo se admiten `--check` y `--flow` con un escenario configurado.
- Faltaban capturas explícitas y directorios únicos para conservar cada ejecución.
- La limpieza solo cubría la finalización normal y un error podía interrumpir el
  resto de operaciones. Ahora se intentan todas y se atienden SIGINT/SIGTERM.

La rama reutilizada es `chore/android-preview-build`. Se mantienen intactos los
cambios ajenos a esta tarea. No se alteran workflows, dependencias, pantallas,
Google Sign-In, identificadores ni backend.

## Archivos y escenarios

| Archivo                                                        | Responsabilidad                                                                                                               |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `scripts/maestro.cjs` (conservado)                             | Ejecuta la distribución local de Maestro mediante Java, sin shell intermedia; desactiva analítica Maestro.                    |
| `scripts/maestro-e2e.cjs`                                      | Preflight, dispositivo, autorización, servidores, ejecución, evidencias y limpieza.                                           |
| `scripts/maestro-api.cjs`                                      | API ficticia extraída del runner; solo lecturas previstas.                                                                    |
| `scripts/maestro-check.cjs`                                    | Sintaxis YAML, cabeceras y referencias de flujos. Usa el parser `yaml` ya instalado en el árbol npm; sin añadir dependencias. |
| `scripts/maestro-infra.test.cjs`                               | Pruebas Node de API y validador; no requieren Android.                                                                        |
| `.maestro/catalog.yaml`                                        | E2E-01: abrir, explorar, dos productos, buscar uno, búsqueda vacía, borrar búsqueda y solo disponibles.                       |
| `.maestro/product-detail.yaml`                                 | E2E-02: abrir producto numérico desde catálogo, nombre, descripción, compra/renta, acciones y características.                |
| `.maestro/cart.yaml`                                           | E2E-03: producto, agregar, abrir carrito, aumentar cantidad, eliminar, vacío y deshacer.                                      |
| `.maestro/support/open-test-product.yaml`                      | Sustituye `open-preview-product.yaml`; abre `Equipo E2E 1` mediante la navegación existente de Expo Router.                   |
| `.maestro/support/open-app.yaml`                               | Inicio limpio; documenta la condición de ejecución desde el runner.                                                           |
| `.maestro/onboarding.yaml`, `.maestro/tabs.yaml` (conservados) | Introducción y conservación de búsqueda/navegación entre pestañas.                                                            |

`config.yaml` conserva los cinco escenarios. `APP_ID` se inyecta desde `app.json`,
con comprobación de `com.cemydi.app`; `DEV_CLIENT_URL` apunta al Metro de esta
sesión mediante `exp+cemydi-mobile://expo-development-client/?url=...`.
El inicio espera explícitamente el botón `Connect` del Dev Launcher antes de abrir
el enlace, para evitar que su arranque inicial descarte la apertura.
El enlace también lleva `disableOnboarding=1`, `disableFab=1` y
`disableAutoLaunch=1`, soportados por `DevLauncherController` del SDK 57 instalado.
Desactivan la introducción, el botón flotante y la apertura automática del menú de
Expo; no omiten la bienvenida de CEMYDI. El botón flotante interceptaba `Omitir`.
La URL se cita también al consultar su resolución mediante la shell remota de ADB.
Los selectores usan los textos y labels actuales, con esperas de 15–30 segundos
para datos y hasta 120 segundos para la primera carga del bundle. La validación
estática no comprueba semántica Maestro ni visibilidad real de esos selectores.

## Preparación de herramientas y Development Build

Se necesitan Node y dependencias del proyecto ya instaladas, Java 17 o superior,
Android SDK Platform Tools y Maestro. No se instalan herramientas automáticamente.
La distribución oficial de Maestro debe tener `lib/` en
`.tools/maestro/maestro/`, o configurar `CEMYDI_MAESTRO_HOME` con esa carpeta raíz.

```powershell
Set-Location 'C:\Users\Victo\Documents\ortopedia-cemydi-web\cemydi-mobile'
java --version
adb version
npm run maestro -- --version
npm run maestro -- test --help
npm run test:e2e -- --check
node --test scripts/maestro-infra.test.cjs
```

ADB se resuelve en este orden: `CEMYDI_ADB` (ruta del ejecutable),
`ANDROID_HOME`/`ANDROID_SDK_ROOT` + `platform-tools`, y `adb` en PATH.
Las rutas con espacios se pasan como argumentos, sin concatenarlas a una shell.

**Un APK Preview no es un Development Build.** El perfil `development` existente
usa `developmentClient: true`; `preview` usa `false`. El runner consulta `pm path`,
`dumpsys package`, el flag `DEBUGGABLE`, Expo Dev Launcher y la resolución del
scheme de desarrollo. No abre una build que no supera estas comprobaciones.

Los siguientes comandos requieren revisar y **autorizar la generación e
instalación**. En la continuación de esta tarea el usuario sí autorizó la
compilación local y la instalación; su evidencia se registra al final. Como ambos builds usan `com.cemydi.app`, usar un dispositivo de pruebas
dedicado; una firma distinta puede impedir reemplazar la instalación anterior.
No desinstalar ni borrar datos de una app existente sin identificarla y autorizarlo.

Opción local, con Android Studio/SDK/JDK compatibles ya preparados; Expo aplica CNG:

```powershell
$env:EXPO_NO_DOTENV = '1'
$env:EXPO_PUBLIC_APP_ENV = 'development'
$env:EXPO_PUBLIC_API_URL = 'http://127.0.0.1:4198'
# CNG aplica la configuración nativa actual sin instalar dependencias.
node node_modules/expo/bin/cli prebuild --platform android --no-install
# Expo CLI 57 exige el nombre del dispositivo, no su serial ADB.
# Ejemplo verificado para este HUAWEI: STK_LX3.
npm run android -- --device STK_LX3 --no-bundler
```

Alternativa EAS, si su CLI ya está instalada y la cuenta/proyecto están preparados:

```powershell
eas build --platform android --profile development
# Solo tras autorizar también la descarga y disponer del APK local:
adb -s SERIAL install -r 'C:\ruta\development.apk'
```

No se modifica configuración nativa manualmente. Si Android bloquea HTTP local,
revisar la política de red de la build de desarrollo y su log; no relajar la
configuración de producción ni confundir ese error con un fallo del catálogo.

Referencias oficiales: [Development Builds de Expo](https://docs.expo.dev/develop/development-builds/introduction/),
[instalación de Maestro](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli).

## Conectar e identificar Android

Emulador: iniciar manualmente un AVD dedicado en Device Manager de Android Studio.
Teléfono: activar opciones de desarrollador y depuración USB, conectar el cable y
aceptar la autorización RSA. No se necesita conectar el teléfono a la API por LAN:
ADB reverse proporciona los dos puertos de loopback también en USB.

```powershell
adb devices -l
$env:CEMYDI_E2E_DEVICE = 'SERIAL'
adb -s $env:CEMYDI_E2E_DEVICE shell getprop ro.product.model
adb -s $env:CEMYDI_E2E_DEVICE shell getprop ro.build.version.release
adb -s $env:CEMYDI_E2E_DEVICE shell pm path com.cemydi.app
```

El estado debe ser `device`, no `offline` ni `unauthorized`. La selección siempre
es explícita, incluso si solo hay un dispositivo. Estos comandos son de lectura.
Ejecutar el runner sin autorización de limpieza permite comprobar el preflight;
se detiene antes de abrir o borrar la app.

## Ejecutar tras autorizar la limpieza

**Cada flujo borra todos los datos de `com.cemydi.app` en el dispositivo indicado**
mediante `launchApp.clearState`. Esto elimina sesión, preferencias e historial y
permite empezar como invitado sin restaurar tokens reales. No usar una instalación
personal. Quien ejecute estos comandos debe haber identificado el dispositivo y
aprobado expresamente esa limpieza. Un agente debe obtener esa autorización del
usuario antes de establecer la variable; no debe deducirla de que el serial exista.

```powershell
# Solo después de esa autorización para este serial y esta aplicación:
$env:CEMYDI_E2E_ALLOW_CLEAR = $env:CEMYDI_E2E_DEVICE
try {
    npm run test:e2e
} finally {
    Remove-Item Env:CEMYDI_E2E_ALLOW_CLEAR
}
```

Para un escenario, usar en lugar del comando de la suite:

```powershell
npm run test:e2e -- --flow catalog.yaml
npm run test:e2e -- --flow product-detail.yaml
npm run test:e2e -- --flow cart.yaml
```

Estos comandos también requieren las dos variables anteriores y borran datos.
No ejecutar los YAML directamente con `npm run maestro -- test .maestro`:
eso omite las protecciones y la API aislada del runner.

## API simulada y aislamiento

El runner inicia su propio Metro en `127.0.0.1:8091` y HTTP ficticio en
`127.0.0.1:4198`. No iniciar otro Metro manualmente. Comprueba disponibilidad de
puertos; si están ocupados falla sin matar procesos ajenos ni cambiar puertos en
silencio. Usa `adb reverse --no-rebind` y elimina únicamente sus redirecciones.
Para elegir otra pareja libre antes de ejecutar:

```powershell
$env:CEMYDI_E2E_METRO_PORT = '8092'
$env:CEMYDI_E2E_API_PORT = '4199'
```

Metro recibe entorno público nuevo, `development`, API y web de loopback, clientes
Google vacíos, `EXPO_NO_DOTENV=1`, `EXPO_OFFLINE=1`, `EXPO_NO_TELEMETRY=1` y caché
reiniciada con `--clear`. Se eliminan valores `EXPO_*` heredados y el override de
host Metro antes de fijar esos valores. No se modifican `.env` ni el código de login.

La API no tiene cliente de backend, base de datos ni proxy/fallback externo.
Sirve dos productos ficticios: `Equipo E2E 1` con stock 3 y `Equipo E2E 2` con stock 0;
ambos con precio 1200, modalidad MIXTO y renta diaria 60. Sin imágenes remotas,
reseñas ni promociones. Los contratos se contrastaron con schemas móviles y los
controllers/services de productos y reseñas del backend local, sin modificarlo.

Solo se aceptan:

- `GET /products`: búsqueda, paginación, `sort=reciente` y `soloDisponibles=true`.
- `GET /products/1` y `/products/2`.
- `GET /products/{1|2}/recommendations?limit=5`.
- `GET /reviews/product/{1|2}`.
- `GET /promotions`.

Cualquier escritura, Authorization, cookie, ruta o filtro ajeno devuelve error y
queda contado como petición inesperada; hace fallar el resultado global. No se
registran headers, bodies ni texto de búsqueda en ese registro. El carrito es el
carrito local de invitado existente. Este mock verifica UI/transporte bajo fixtures;
no acredita integración, autorización ni reglas del backend real.

La preparación no aplica un firewall a todo Android. Mantener el dispositivo
sin datos personales y no abrir servicios externos fuera de los flujos. No se
prueban Google, pagos, correo ni push reales.

## Evidencias, fallos y limpieza

Cada ejecución que supera el preflight crea
`test-results/maestro/<fecha-hora-UTC>/`, ya ignorado por Git:

- `results.xml`: JUnit con resultados y tiempos por flujo que Maestro haya ejecutado.
- Capturas explícitas `E2E-01-busqueda`, `E2E-01-disponibles`,
  `E2E-02-caracteristicas` y `E2E-03-deshacer`, bajo la estructura de Maestro.
- Artefactos de diagnóstico/fallo según Maestro, incluidos logs y comandos.
- `maestro-console.log` y `metro.log` para diagnosticar CLI y bundle.
- `run.json`: dispositivo, app, escenario, inicio, duración total, código de salida,
  interrupción, peticiones inesperadas y error de infraestructura/limpieza.

La ayuda de Maestro 2.11.0 instalada confirmó `--format`, `--output`,
`--debug-output` y `--test-output-dir`. El runner comprueba los flags de directorio
antes de arrancar servidores. No se usan flags cloud, análisis AI, reintentos
para ocultar fallos ni salida aprobada artificial. JUnit solo aparece si Maestro
llega a producirlo; los errores de preflight no generan una suite verde.
Consultar [reportes y artefactos de Maestro](https://docs.maestro.dev/maestro-flows/workspace-management/test-reports-and-artifacts).

Un fallo Maestro conserva su código. Peticiones inesperadas, interrupciones y
fallos de limpieza devuelven error incluso si JUnit marca verde: consultar también
`run.json` y la salida npm. En `finally` se detienen los árboles propios de procesos
(Maestro/Java y Metro), se cierra la API y se retiran las redirecciones propias.
Ctrl+C se atiende como interrupción. Un cierre forzado del proceso anfitrión, caída
del sistema o desconexión ADB puede impedir limpiar; se informa de los errores.
No usar `adb reverse --remove-all` ni matar puertos de forma indiscriminada.

## Validación inicial sin dispositivo

Comprobado sin dispositivo:

- ADB disponible y `adb devices -l` sin dispositivos conectados.
- Expo 57.0.31 y Maestro 2.11.0; ayuda local de los flags usados.
- `npm run test:e2e -- --check`: cinco flujos y referencias válidos.
- `node --test scripts/maestro-infra.test.cjs`: seis pruebas aprobadas.
- `npm run test:e2e`: error esperado de selección/dispositivo; ningún flujo ejecutado.

- `npm run lint`: aprobado.
- `npm run typecheck`: aprobado.
- `npm run format:check`: aprobado.
- `npm test -- --ci`: 70 suites y 375 pruebas aprobadas, 55.377 s. Emitió
  advertencias de actualizaciones fuera de `act(...)` en las pruebas existentes de
  favoritos e inicio; no hubo fallos ni se modificaron esas suites.
- `git diff --check`: sin errores de espacios.

En esa primera etapa aún no se habían ejecutado E2E Android ni generado
JUnit/capturas nuevos. La continuación con teléfono físico se documenta abajo.
Las comprobaciones Android no acreditan iOS ni CI E2E.

## Ejecución física verificada — 25 de octubre de 2026

Resultado final: **5/5 flujos aprobados, 0 fallos**, sin intervención manual
durante esa ejecución. HUAWEI STK-LX3, Android 10, Expo 57.0.31, Maestro 2.11.0
y Java 24. Se usaron exclusivamente los fixtures HTTP locales y el carrito de
invitado. No se crearon usuarios, pedidos, rentas ni transacciones.

El usuario desinstaló la versión release y autorizó instalar la build local;
posteriormente autorizó compilar e instalar una build actualizada. El APK anterior
carecía de `ExpoPushTokenManager`. CNG y la compilación local incluyeron los módulos
actuales, sin modificar dependencias ni archivos nativos manualmente. Gradle
terminó con `BUILD SUCCESSFUL in 7m 10s` y se instaló el APK arm64 de desarrollo.
La build quedó instalada como `com.cemydi.app`, versión 1.0.0.

SHA-256 de `android/app/build/outputs/apk/debug/app-debug.apk`:
`1D3824769E6595B391BC5C19C083C5CB69C66FEF597E0396E30B18FB425C3D1A`.
Metadatos adicionales en `test-results/maestro/development-build.json`.
La build incluye cambios locales sin commit; no es una release publicada.

La ejecución aceptada está en:
`test-results/maestro/2026-10-26T04-12-16-989Z/`.
El nombre de carpeta usa UTC; las pruebas se ejecutaron el 25 de octubre en
America/Mexico_City, aproximadamente de 22:12 a 22:18.

| Flujo                                                        | Resultado | Duración JUnit |
| ------------------------------------------------------------ | --------- | -------------- |
| E2E-01: catálogo, búsquedas, limpieza y disponibilidad       | Aprobado  | 91.721 s       |
| E2E-02: detalle, descripción, compra/renta y características | Aprobado  | 55.364 s       |
| E2E-03: agregar, cantidad, eliminar, vacío y deshacer        | Aprobado  | 84.092 s       |
| Introducción y acceso público                                | Aprobado  | 37.528 s       |
| Pestañas, búsqueda conservada y acceso invitado a Perfil     | Aprobado  | 83.860 s       |

`results.xml` registra `tests="5"`, `failures="0"`. Maestro informó 5 min 53 s;
`run.json` registra 379708 ms totales, `exitCode: 0`, `interrupted: false` y
`unexpected: []`. Los tiempos totales incluyen preparación y limpieza; los tiempos
JUnit son los de los flujos.

Capturas verificadas, bajo
`2026-10-25_221226/<nombre del flujo>/takeScreenshot/`:

- `E2E-01-busqueda.png`.
- `E2E-01-disponibles.png`.
- `E2E-02-caracteristicas.png`.
- `E2E-03-deshacer.png`: producto ficticio restaurado con cantidad 2 y subtotal
  ficticio de $2,400 MXN.

Se conservaron los intentos previos fallidos y sus logs. El intento
`2026-10-26T03-41-26-839Z` tuvo apertura manual del deep link durante el diagnóstico:
su `review.json` indica que no sirve como evidencia de ejecución autónoma. Los
intentos detenidos manualmente conservan salida de error y sus notas de revisión.
La suite completa `2026-10-26T03-53-42-778Z` conservó su JUnit de 4 aprobados y
1 fallido. No se reescribieron esos resultados para aparentar éxito.

Correcciones adicionales surgidas de la ejecución física:

- Esperar `Connect` antes de abrir el proyecto, evitando una carrera durante el
  arranque inicial del Dev Launcher.
- Pasar los flags de prueba del SDK 57 para evitar que el menú de Expo y su botón
  flotante intercepten los controles de CEMYDI. No se modifica UI de negocio.
- Citar el enlace al resolverlo por ADB para preservar sus parámetros con `&`.
- En carrito, limitar `waitToSettleTimeoutMs` a 100 ms después de eliminar y al
  deshacer, con un solo toque. La espera predeterminada de Maestro consumía más
  de 9 s y vencía el aviso existente de 6 s. Se mantienen las aserciones de vacío
  y cantidad restaurada; no se cambia la duración del aviso en producción.
- Usar el nombre `STK_LX3` en Expo CLI y el serial explícito en Maestro/ADB.

La última revisión volvió a aprobar ESLint, TypeScript y las seis pruebas Node de
infraestructura. El registro inicial conserva las 70 suites y 375 tests
Jest aprobados; no se modificaron esas pruebas. `npm run format:check` y
`git diff --check` también aprobaron la revisión final.

Limpieza comprobada después de salir del runner: sin listeners en 8091/4198/8081,
sin redirecciones ADB y sin procesos Java de Maestro pendientes. La redirección
8081 que creó Expo al instalar la build se retiró explícitamente. Se cerró la app
de pruebas al terminar; la build de desarrollo permanece instalada.

Limitaciones y avisos conservados:

- La validación nativa cubre este teléfono y Android 10; no acredita otros Android,
  iOS, rendimiento, offline, push real, Google Sign-In ni integración con NestJS.
- Maestro 2.11.0 en Windows registra fallos de heartbeat de su archivo de sesiones;
  la suite final sí completó los cinco flujos y devolvió código 0. El problema está
  reportado en [Maestro #3414](https://github.com/mobile-dev-inc/maestro/issues/3414).
  También quedan avisos de Java y concesiones intentadas por Maestro de permisos
  de badge inexistentes en el dispositivo. No se ocultaron ni se parcheó la CLI.
- Metro registró avisos de resolución de assets del manifiesto. En la ejecución
  final no reapareció el error `Cannot find native module 'ExpoPushTokenManager'`.
- Las evidencias siguen ignoradas por Git. No hubo push, merge ni despliegue.
