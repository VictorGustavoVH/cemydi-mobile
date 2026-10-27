# Seguridad automatizada: alcance y operación

Implementación técnica de Víctor Gustavo Valdivia Hernández para la Actividad 5.
No modifica el cliente, autenticación, dependencias npm o backend.

## Estado y alcance

- `sast`: Semgrep Community Edition **1.182.0**, instalado en un entorno Python
  aislado. Diez reglas propias versionadas en `.semgrep/mobile.yml`, con casos
  positivos y negativos ejecutados contra el motor real. No se descarga un ruleset
  mutable del registro durante el análisis.
- `dast`: **solo smoke de infraestructura**, opcional en `workflow_dispatch` con
  `dast_smoke=true`. ZAP Baseline **2.17.0**, imagen fijada por digest. No evalúa
  NestJS ni la seguridad del backend CEMYDI. En PR queda omitido salvo activación
  manual por etiqueta conforme a las restricciones siguientes.
- **DAST del backend pendiente**: el repositorio móvil no contiene un despliegue
  aislado de NestJS y PostgreSQL. Los e2e del backend requieren configuración y DB;
  no acreditan un servicio reproducible disponible para este workflow.
- Una ejecución verde de este workflow NO acredita un análisis SAST/DAST completo.
  El nombre del workflow, del job DAST y sus resultados conservan esta distinción.

No hay entrada de URL, credenciales, cookies ni secretos. El runner DAST solo admite
su propio fixture en `http://127.0.0.1:4199/`, creado dentro del job. Para incorporar
el backend real se necesita autorización expresa, infraestructura aislada y una
revisión del alcance; no basta con cambiar una variable de entorno.

La interfaz de GitHub para dispatch normalmente requiere el workflow en la rama
predeterminada. En este repositorio se pudo ejecutar por API/CLI usando el ID del
workflow después de registrarlo con el PR, sin merge. Como alternativa, el propietario puede activar el smoke
añadiendo la etiqueta seguridad:dast-fixture a un PR del mismo repositorio. El job
solo se activa para ese evento labeled, actor propietario y origen interno; una
etiqueta en un fork o aplicada por otro actor no lo habilita. Al cambiar el commit,
se debe volver a activar explícitamente. No se ejecuta código con permisos
privilegiados ni se usa pull_request_target.

## Política SAST

Se analizan `src/`, `scripts/`, `plugins/` y configuraciones JS/JSON de la raíz,
excepto el lockfile de dependencias. `.semgrepignore` excluye dependencias, proyectos
nativos generados y artefactos, sin excluir features productivas ni pruebas.

Reglas: ejecución dinámica (`eval`/`Function`), TLS desactivado, argumentos de CLI
hacia shell, procesos con `shell: true`, secretos en AsyncStorage, logs de campos
sensibles, variables Expo públicas con nombres de secretos, acceso universal desde
archivos en WebView y marcadores de claves privadas.

Semgrep CE usa `ERROR`, `WARNING` e `INFO`; no se inventan banderas `--severity HIGH`
o `CRITICAL`. Cada regla declara un riesgo **propio de esta política** en
`metadata.cemydi-risk`. Se bloquea cualquier candidato HIGH/CRITICAL, aunque aún no
esté confirmado. MEDIUM/LOW se conservan para revisión. Los errores del scanner,
reportes incompatibles y ausencia de cobertura de `src/` o `scripts/` también fallan.

`semgrep scan` puede terminar con 0 aunque existan hallazgos. Por eso el runner
comprueba el código de salida, `errors`, versión y JSON antes de aplicar la política.
`--strict` impide tratar errores de análisis como éxito y `--disable-nosem` impide
silenciar candidatos mediante comentarios. No hay supresiones ni allowlist.

Los resultados son **candidatos pending-review**, no vulnerabilidades confirmadas.
Un falso positivo requiere evidencia y revisión de precisión de la regla; no se
rebaja ni excluye un hallazgo crítico para conseguir verde. La edición CE y estas
reglas tienen cobertura limitada: no garantizan análisis entre archivos, detección
de todos los alias, vulnerabilidades nativas, dependencias o secretos arbitrarios.

Los artefactos `semgrep.json`, `semgrep.sarif` y `summary.txt` conservan regla,
severidad, archivo y línea. Se omiten snippets y metavariables que podrían revelar
credenciales. Se conservan el inventario de archivos analizados y el SHA-256 del
ruleset. Si falta un archivo JS/TS/JSON inventariado en las rutas seleccionadas,
el runner falla. El JSON nativo temporal se elimina; no se sube a GitHub.

Semgrep 1.182.0 no pudo interpretar dos tipos typeof import de la prueba existente
auth-patterns.test.tsx. Se expresaron como un objeto tipado con authSession:
solo cambia el tipado de la lectura de módulo. Las llamadas, expectativas y lógica
productiva permanecen iguales; no se excluyó el archivo ni se ocultó el error.

## Política ZAP y límites del smoke

Se usa exclusivamente `zap-baseline.py`, sin escaneo activo, Ajax spider, login o
reglas alfa. El contexto limita el origen y las rutas; el fixture no ofrece enlaces
externos, redirecciones ni mutaciones. Spider: 1 minuto, profundidad 2, 10 hijos;
espera máxima de ZAP: 3 minutos; proceso Docker limitado a 8 minutos y job a 12.
`-silent` evita actualizaciones automáticas de complementos durante el run.

Baseline devuelve 0 (éxito), 1 (FAIL configurado), 2 (WARN) o 3 (error de ejecución).
El runner acepta 0/2 solo con JSON/HTML válidos y objetivo verificado. Un 1 falla;
3, timeout, ausencia de Docker/objetivo/reportes o sitio externo fallan. Se bloquean
además todas las alertas High (`riskcode=3`); Medium/Low/Informational permanecen
visibles. ZAP no define aquí un nivel Critical separado. No se usa `-I` ni se ignoran
reglas. Los riesgos vienen del reporte real, no del nombre de una alerta.

`zap.html`, `zap.json`, `zap.log` y `policy.json` se conservan como evidencia **del
fixture**, nunca como evidencia de seguridad del backend. Docker solo monta el
directorio de reportes y usa el UID/GID del runner, sin privilegios adicionales.

## Reproducir

Pruebas del arnés y políticas, sin Docker ni backend:

```bash
node --test scripts/security/security.test.cjs
```

Herramienta aislada en Linux/macOS:

```bash
python3 -m venv .tools/security-semgrep
.tools/security-semgrep/bin/python -m pip install semgrep==1.182.0
node scripts/security/sast.cjs --test-rules --semgrep .tools/security-semgrep/bin/semgrep
node scripts/security/sast.cjs --semgrep .tools/security-semgrep/bin/semgrep
```

En Windows usar `python`, `Scripts/python.exe` y `Scripts/semgrep.exe` en las rutas
equivalentes. Las pruebas materializan el fixture de texto en un directorio temporal
y comparan ubicaciones y reglas reales con las anotaciones; no ejecutan el código
intencionalmente inseguro ni dependen del subcomando experimental de tests.

En Linux con Docker disponible, únicamente contra el fixture creado por el runner:

```bash
node scripts/security/dast-smoke.cjs
```

Reportes locales ignorados por Git: `test-results/security/`. No se instalan paquetes
npm ni se altera `quality.yml`, `tests.yml` o sus jobs Android. El workflow requiere
solo `contents: read`; no publica comentarios, issues ni SARIF en la API de Code
Scanning. Los archivos SARIF quedan descargables como artefactos durante 14 días.

Hasta ejecutar el nuevo workflow en GitHub, su funcionamiento en ese runner queda
pendiente de validación. La ejecución real de ZAP requiere Docker Linux; no se
confunde la aprobación de pruebas del arnés con haber ejecutado ZAP.

## Referencias de versiones y opciones

- [Semgrep 1.182.0](https://github.com/semgrep/semgrep/releases/tag/v1.182.0)
- [CLI Semgrep](https://docs.semgrep.dev/cli-reference)
- [ZAP 2.17.0](https://github.com/zaproxy/zaproxy/releases/tag/v2.17.0)
- [Opciones y salidas de Baseline](https://www.zaproxy.org/docs/docker/baseline-scan/)
- Digest de `ghcr.io/zaproxy/zaproxy:2.17.0` verificado en el registro GHCR al
  preparar esta implementación; se conserva en `tools.json`.
