# Contexto del proyecto CEMYDI Mobile

## Qué es CEMYDI

CEMYDI es un ecosistema para la operación digital de Ortopedia CEMYDI. El código auditado está distribuido en tres aplicaciones independientes:

- `cemydi-backend`: API NestJS, persistencia y reglas de negocio.
- `cemydi-frontend`: sitio web público, cuenta del cliente y panel administrativo.
- `cemydi-mobile`: nuevo cliente móvil Expo para Android e iOS.

Este documento describe el estado del working tree auditado. Los repositorios contienen cambios locales que pueden no pertenecer todavía a una release.

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
- reseñas;
- persistencia PostgreSQL mediante Prisma;
- Cloudinary, Brevo y Google Drive.

El cliente móvil no debe reproducir estas reglas. Las validaciones locales sirven para UX y nunca sustituyen la validación del servidor.

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
Stack raíz. La bienvenida permite explorar sin cuenta. Véanse AUTHENTICATION.md,
CATALOG.md, CART.md, NOTIFICATIONS.md y MOBILE_QUALITY.md para contratos y límites.

## Alcance móvil previsto

- registro de clientes;
- verificación de correo y recuperación de contraseña cuando se definan sus flujos móviles;
- inicio, mantenimiento y cierre de sesión;
- catálogo, búsqueda, filtros y detalle de producto;
- carrito de productos en modo `VENTA` y `RENTA`;
- aplicación y retiro de cupones mediante el carrito;
- configuración y solicitud de rentas;
- carga de recetas cuando sean requeridas;
- perfil del cliente;
- consulta, detalle y cancelación permitida de rentas;
- estados loading, empty, error y pérdida de conectividad.

## Fuera de alcance

- panel administrativo;
- administración de productos, promociones, cupones, usuarios o rentas;
- respaldos, mantenimiento, analítica administrativa y Google Drive;
- duplicación de reglas del backend;
- cambios automáticos al backend o a la web;
- checkout, pedidos y pagos mientras no exista un contrato real.

> **NOT IMPLEMENTED IN CURRENT BACKEND:** no se observaron endpoints de checkout, creación de pedidos de venta, procesamiento de pagos ni seguimiento de pedidos. El carrito de venta existe, pero no un flujo confirmado para finalizar la compra.

## Fuentes de verdad

En caso de contradicción, usa este orden:

1. controllers, DTOs, services, guards y schema Prisma del backend actual;
2. comportamiento y schemas validados del frontend web;
3. documentación mantenida en `cemydi-mobile/docs`;
4. intención académica o de producto no materializada en código.

No inventes endpoints, DTOs, roles, permisos, campos de respuesta ni estados.

## Estado confirmado del móvil

- Expo SDK 57 con Expo Router y typed routes.
- React Native 0.86 y React 19.
- TypeScript estricto y alias `@/*` hacia `src/*`.
- NativeWind 4 sobre Tailwind CSS 3.
- Color `brand` actual: `#258e8b`.
- No existen `ios/` ni `android/`; se usa Continuous Native Generation.
- Existen configuración validada, HTTP público, TanStack Query, conectividad, tokens y UI compartida. Bienvenida conduce a `/inicio`, que muestra seis productos reales, banner y cuatro categorías editoriales originales, visibles incluso mientras carga o falla la API. `/catalogo` acumula páginas de 24 con búsqueda/filtros remotos; los ids numéricos de detalle consultan API. Autenticación y carrito consumen el backend; se conserva un carrito temporal para invitados. Las notificaciones completan campana, permisos y lifecycle nativo, con entrega real pendiente de configuración EAS/FCM/APNs. `/diagnostico` ya no existe. Jest/Testing Library están configurados. Véase [CATALOG.md](./CATALOG.md).
- El repositorio móvil usa `develop` como rama de integración y conserva `main` para versiones estables y validadas.
- `npm run lint`, `npm run typecheck`, `npm run format:check` y `npm test` pasan correctamente.

## Decisiones pendientes

- URL de API por entorno y política HTTPS;
- Google Sign-In móvil y redirect URIs;
- verificación de correo por código, app link o ambos;
- significado del carrito de venta sin checkout actual;
- soporte formal de tablet;
- ejecución de los cinco flujos Maestro en una development build Android;
- política offline y descarga/visualización de documentos;
- credenciales push y configuración EAS; los identificadores nativos están en app.json.
