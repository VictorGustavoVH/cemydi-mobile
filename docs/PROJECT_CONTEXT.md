# Contexto del proyecto CEMYDI Mobile

## Qué es CEMYDI

CEMYDI es un ecosistema para la operación digital de Ortopedia CEMYDI. El código se distribuye en tres aplicaciones independientes:

- `cemydi-backend`: API NestJS, persistencia y reglas de negocio.
- `cemydi-frontend`: sitio web público, cuenta del cliente y panel administrativo.
- `cemydi-mobile`: cliente móvil Expo para Android e iOS.

Este documento describe el alcance y el estado funcional del cliente móvil. Las versiones concretas de dependencias están en `package.json`.

## Componentes y responsabilidades

### Backend

El backend es la fuente de verdad técnica para:

- autenticación, sesiones, roles y autorización;
- validación de entradas y manejo de errores;
- usuarios y perfil;
- productos, inventario y disponibilidad;
- promociones, cupones y precios finales;
- carrito de venta y renta;
- solicitudes, documentos, depósitos y estados de renta;
- reseñas, favoritos y notificaciones;
- persistencia PostgreSQL mediante Prisma;
- Cloudinary, Brevo, Google Drive y envío de push.

El cliente móvil no reproduce estas reglas. Las validaciones locales sirven para UX y nunca sustituyen la validación del servidor.

### Frontend web

La web es una referencia funcional de flujos y contratos observados. Contiene:

- sitio público y catálogo;
- autenticación y cuenta del cliente;
- carrito y solicitudes de renta;
- panel administrativo completo.

Sus implementaciones dependientes de Next.js, SSR, DOM, cookies del navegador, `localStorage`, `XMLHttpRequest`, Radix o layouts de escritorio no son portables directamente a React Native.

### Aplicación móvil

El móvil integra autenticación real con tokens explícitos, catálogo público,
perfil/favoritos, carrito conectado y notificaciones de clientes. Inicio, Catálogo,
Carrito y Perfil viven en pestañas; los detalles y formularios permanecen en el
Stack raíz. La bienvenida permite explorar sin cuenta. Las rutas privadas esperan
la restauración de sesión y conservan un destino interno permitido. Véanse
AUTHENTICATION.md, CATALOG.md, CART.md, NOTIFICATIONS.md y MOBILE_QUALITY.md para
contratos y límites.

La app incluye:

- catálogo, búsqueda, filtros, detalle, reseñas, recomendaciones y favoritos;
- registro con verificación por código, login, recuperación de contraseña y Google Sign-In nativo;
- sesión con access token en memoria y refresh rotatorio en `expo-secure-store` cuando se elige mantenerla;
- carrito del backend para cuentas autenticadas y carrito local en memoria para invitados;
- cupones, cantidades, fechas y notas de renta;
- perfil editable, rentas propias, cambio de correo/contraseña y documentos legales;
- bandeja de notificaciones, preferencias y registro de push;
- estados loading, empty, error, reintento y pérdida de conectividad.

## Alcance implementado

### Catálogo y productos

- Inicio consume seis productos reales y promociones activas.
- `/catalogo` pagina de 24 en 24 con búsqueda remota, filtros, orden y búsqueda por voz.
- `/producto/[id]` consume detalle, reseñas y recomendaciones públicas.
- Los productos con id numérico se pueden agregar al carrito; los fixtures locales se conservan para pruebas.

### Autenticación y cuenta

- `POST /auth/register` no crea sesión: inicia verificación por código.
- Login, Google nativo, refresh y logout usan los endpoints móviles con tokens explícitos.
- El perfil permite editar `nombre`, `telefono` y `direccion`.
- Correo y contraseña se cambian con desafíos OTP independientes.
- Logout limpia memoria, caché privada y la credencial de SecureStore.

### Carrito y rentas

- Una cuenta autenticada usa el carrito del backend con sincronización periódica.
- Un invitado conserva un carrito local en memoria durante el proceso.
- Se admiten compra y renta, cupones, cantidades, fechas y notas.
- Las rentas propias se consultan, detallan y cancelan cuando el backend lo permite.
- **No implementado en móvil:** creación de la solicitud de renta desde el carrito (`POST /rentals/from-cart`) y carga de recetas.

### Notificaciones

- Bandeja paginada con filtros por categoría, lectura individual y masiva.
- Preferencias por categoría y activación de push por dispositivo.
- El detalle está en [NOTIFICATIONS.md](./NOTIFICATIONS.md).

## Fuera de alcance

- panel administrativo;
- administración de productos, promociones, cupones, usuarios o rentas;
- respaldos, mantenimiento, analítica administrativa y Google Drive;
- duplicación de reglas del backend;
- cambios automáticos al backend o a la web;
- checkout, pedidos de venta y pagos mientras no exista un contrato real;
- soporte web.

> **NOT IMPLEMENTED IN CURRENT BACKEND:** no se observaron endpoints de checkout, creación de pedidos de venta, procesamiento de pagos ni seguimiento de pedidos. El carrito de venta existe, pero no un flujo confirmado para finalizar la compra.

## Fuentes de verdad

En caso de contradicción, usa este orden:

1. controllers, DTOs, services, guards y schema Prisma del backend actual;
2. comportamiento y schemas validados del frontend web;
3. documentación mantenida en `cemydi-mobile/docs`;
4. intención académica o de producto no materializada en código.

No inventes endpoints, DTOs, roles, permisos, campos de respuesta ni estados.

## Estado técnico confirmado

- Expo SDK 57 con Expo Router y typed routes.
- React Native 0.86 y React 19.
- TypeScript estricto y alias `@/*` hacia `src/*`.
- NativeWind 4 sobre Tailwind CSS 3.
- TanStack Query 5 con `staleTime` de 30 segundos, dos reintentos para errores retryables y pausa offline.
- Color `brand` actual: `#258e8b`.
- No se versionan `ios/` ni `android/`; se usa Continuous Native Generation.
- Existen configuración validada, HTTP público, TanStack Query, conectividad, tokens y UI compartida. Bienvenida conduce a `/inicio`, que muestra seis productos reales, banner y cuatro categorías editoriales originales, visibles incluso mientras carga o falla la API. `/catalogo` acumula páginas de 24 con búsqueda/filtros remotos; los ids numéricos de detalle consultan API. Autenticación y carrito consumen el backend; se conserva un carrito temporal para invitados. Las notificaciones completan campana, permisos y lifecycle nativo, con entrega real pendiente de configuración EAS/FCM/APNs. `/diagnostico` ya no existe. Jest/Testing Library están configurados. Véase [CATALOG.md](./CATALOG.md).
- El repositorio móvil usa `develop` como rama de integración y conserva `main` para versiones estables y validadas.
- El scheme `cemydi://` solo abre rutas internas y no transporta tokens ni secretos.
- Jest, React Native Testing Library y Maestro están configurados. La ejecución nativa de Maestro sigue pendiente de entorno.
- `npm run lint`, `npm run typecheck`, `npm run format:check` y `npm test` son las validaciones locales obligatorias.

## Decisiones pendientes

- URL de API por entorno y política HTTPS;
- validación nativa de Google Sign-In y notificaciones push en Android e iOS;
- significado del carrito de venta sin checkout actual;
- soporte formal de tablet y breakpoints;
- ejecución E2E de Maestro con una build instalable;
- política offline más allá de detección de conectividad y refetch;
- descarga, vista previa y compartición de documentos de renta;
- app/universal links verificados para tokens de correo;
- identificadores, credenciales y builds de EAS/Google Play;
- soporte web, actualmente fuera de alcance.

Véanse [ARCHITECTURE.md](./ARCHITECTURE.md), [API_INTEGRATION.md](./API_INTEGRATION.md) y [AUTHENTICATION.md](./AUTHENTICATION.md) para las decisiones técnicas.
