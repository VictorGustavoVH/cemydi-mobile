# Seguridad de dependencias

## Preparación de Play — 8 de noviembre de 2026

Expo se alineó a 57.0.32 y los parches recomendados de constants, dev-client,
notifications, router y splash-screen, manteniendo SDK 57 y React Native
0.86. El CLI 57.0.33 trasladó DevTools a `server/devtools`, usa JSON Schema mediante
`@expo/schema-utils` y recibe Zod como argumento para extensiones MCP. Se retiró el
override específico del CLI 57.0.32, que ya no corresponde al consumidor instalado.
La regresión conserva los casos válidos e inválidos y la conversión JSON Schema,
adaptados a las APIs del paquete actualizado; no se omiten pruebas.

## Correcciones del 3 de noviembre de 2026

Se conserva Expo SDK 57, React Native 0.86 y la versión de React del proyecto.
No se modifican autenticación, endpoints ni módulos nativos. No se utiliza
`npm audit fix --force`.

| Hallazgo                          | Resolución                                                                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01, `shell-quote`             | Lockfile actualizado de 1.10.0 a 1.12.0, dentro del rango del consumidor.                                                                                      |
| SEC-02, `decode-uri-component`    | Upstream oficial 0.5.1 mediante adaptador CommonJS de tres líneas, limitado a `query-string@7.1.3`.                                                            |
| SEC-03, `node-forge`              | 1.4.0 a 1.4.2, dentro del rango de Expo CLI y code-signing-certificates. El changelog del mantenedor documenta las correcciones de 1.4.1/1.4.2.                |
| SEC-04, `source-map-js`           | 1.2.1 a 1.2.2, dentro del rango de PostCSS.                                                                                                                    |
| SEC-05, `postcss-selector-parser` | 6.1.4 a 6.1.5, manteniendo la rama 6.                                                                                                                          |
| SEC-05, `glob` moderno            | Override de consumidores de la rama 13 a 14.0.3; usa minimatch 11 y corrige la cancelación del recorrido.                                                      |
| SEC-05, `minimatch` moderno       | Override limitado a consumidores de la rama 10 hacia 11.0.4. Se comprueban la API utilizada por Expo Fingerprint y la búsqueda de archivos.                    |
| REV-01, Zod transitivo            | Expo CLI 57.0.32 usa el mismo Zod 4 del proyecto mediante un override acotado. Se prueban sus schemas de plugins, salida y comandos MCP, incluido JSON Schema. |

Los overrides de Glob/Minimatch son cambios mayores controlados: no se aplican a
`glob@7` ni a `minimatch@3`, cuyas APIs son distintas. Las verificaciones incluyen
lint, tests, configuración Expo y bundles Android/iOS. No equivalen a una prueba
de aceptación en dispositivo.

La compatibilidad CommonJS/ESM está descrita en
[el adaptador](../plugins/decode-uri-component-compat/README.md).
Eliminar los overrides cuando sus consumidores incorporen versiones corregidas
compatibles; revisar este documento si cambia la versión exacta de Expo CLI.

## Avisos restantes y alcance

### Minimatch 3 y propagaciones

La auditoría conserva las coincidencias de `minimatch@3.1.5` y sus propagaciones a
ESLint, Jest, glob 7 y herramientas relacionadas. El rango publicado para
GHSA-g3hv-75wg-m249 incluye `<11.0.1`, pero el fallo descrito ocurre en
`firstPhasePreProcess` con `optimizationLevel >= 2`. Esa optimización se añadió
en la rama 7; no existe en la implementación instalada de la rama 3.

Para ese aviso concreto, la coincidencia de la rama 3 se considera no aplicable
por la implementación examinada. No se sustituye por la rama 11: quitaría la
exportación callable y APIs que esos consumidores todavía necesitan. El JSON de
auditoría conserva todas las coincidencias, sin excepciones ni supresiones.

Referencias: [aviso](https://github.com/advisories/GHSA-g3hv-75wg-m249),
[historial del mantenedor](https://github.com/isaacs/minimatch/blob/v11.0.4/changelog.md).

### Deepmerge 4.3.1

SEC-06 permanece **sin parche upstream publicado**. Lo consumen configuración
Expo y Jest; no se identificó una entrada de usuario de la app que alcance esas
fusiones. Mantener configuraciones y código de build confiables. No instalar
forks arbitrarios ni tratar la ausencia de exposición observada como corrección
del paquete. La auditoría conserva el aviso bajo y sus propagaciones.

Referencia: [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4).

## Auditoría local y CI

```bash
npm run test:dependency-security
npm run security:audit
```

La auditoría ejecuta `npm audit --json` sobre **todas** las dependencias, incluidas
herramientas de desarrollo. Bloquea hallazgos altos/críticos y errores del scanner.
Conserva avisos moderados/bajos y propagaciones para revisión: no hay allowlist ni
exclusión de paquetes. Los conteos de paquetes no equivalen a ataques distintos
ni describen por sí solos el contenido ejecutable del APK.

`security.yml` agrega el job `dependencies` en PR, ejecución manual y revisión
semanal. `npm ci --ignore-scripts` instala el lockfile sin ejecutar scripts de
paquetes. Se prueban correcciones/política y se conservan JSON, resumen y hash
del lockfile durante 14 días. La activación efectiva en GitHub requiere que el
workflow llegue al repositorio; no se hizo push desde esta tarea.

Los reportes locales quedan en `test-results/security/dependencies/` y están
ignorados por Git. Si el registro falla o devuelve un resultado incompatible, la
auditoría falla; no transforma un error de red en ausencia de vulnerabilidades.

## TLS y validación externa

El usuario aprobó sustituir pinning por HTTPS con validación estándar de Android
y CA del sistema para el backend administrado por Render. Release rechaza HTTP
y certificados no confiables; ya no requiere un pin de respaldo. Ver
[ANDROID_RELEASE_SECURITY.md](./ANDROID_RELEASE_SECURITY.md).

## Límites de validación

La prueba del backend en un entorno aislado y la aceptación Android/iOS con una
build instalada siguen pendientes. El ZAP existente solo analiza su fixture;
ningún resultado de este documento acredita seguridad integral del backend.

## Validación de la rama de dependencias — 8 de noviembre de 2026

Esta rama publica únicamente los parches de dependencias, el adaptador CommonJS,
sus regresiones y el job SCA. Los módulos nativos nuevos de formularios, documentos,
capturas y compartir se incorporan con sus respectivas funcionalidades, no aquí.

Validación local del árbol aislado:

- `npm ci --no-audit --no-fund`: aprobado; npm mantiene un aviso de peer entre
  `test-renderer` y React, sin cambiar la versión de React del proyecto.
- `npm run typecheck`, `npm run lint` y `npm run format:check`: aprobados.
- `npm run doctor`: 21 comprobaciones aprobadas.
- `npm test -- --runInBand`: 73 suites y 401 pruebas aprobadas. Persisten avisos
  de `act` en Favoritos; no se silencian.
- `npm run test:dependency-security`: 7 pruebas aprobadas.
- `npm run security:audit`: 0 hallazgos altos/críticos y 10 bajos, incluidas
  propagaciones; el reporte completo permanece ignorado en `test-results/`.

Los resultados de GitHub Actions se comprueban sobre el último commit del PR antes
de continuar con otra rama. La validación local no sustituye esos checks ni la
aceptación nativa.
