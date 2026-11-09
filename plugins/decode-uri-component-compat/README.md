# Compatibilidad del decodificador URI

`query-string@7.1.3`, usado por Expo Router 57, espera que
`require('decode-uri-component')` devuelva una función. Su rango `^0.2.2` retiene
una versión afectada por GHSA-vcc3-ghjq-m6fr y GHSA-qr28-fpjm-wq7f.

El upstream corregido `decode-uri-component@0.5.1` publica únicamente ESM. Este
adaptador exporta su `default` como función CommonJS, sin copiar ni modificar el
algoritmo. La dependencia con alias apunta al paquete oficial del registro npm y
su integridad queda fijada en el lockfile.

El override está limitado a `query-string@7.1.3`. npm resuelve su ruta `file:`
desde el directorio del consumidor, por eso usa `../../plugins/` para llegar a la
raíz del proyecto. Conservar esta carpeta al instalar con `npm ci`.

Node 22.12 o posterior permite cargar este ESM síncrono desde CommonJS. CI usa
Node 22 actualizado y el entorno local/EAS usa Node 24.11. Metro transforma el
import del paquete para Android e iOS. Las pruebas de dependencias verifican el
consumidor real, Unicode, parámetros repetidos y el caso de denegación de servicio.

Retirar el adaptador y el override cuando una versión compatible de Expo Router
utilice directamente un decodificador corregido con una interfaz compatible.
