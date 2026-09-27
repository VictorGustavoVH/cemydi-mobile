# Autenticación de CEMYDI Mobile

La estrategia móvil no está resuelta. Este documento separa comportamiento comprobado de propuestas y no autoriza cambios al backend.

## CURRENT BACKEND BEHAVIOR

### Registro

`POST /auth/register` recibe `nombre`, `correo` y `password`. La contraseña normativa exige 10–72 caracteres, una mayúscula, un número y un símbolo.

El backend:

1. normaliza el correo;
2. crea un usuario con rol `CLIENT` si no existe;
3. almacena la contraseña con bcrypt;
4. envía verificación por correo;
5. devuelve un mensaje genérico para evitar enumeración de cuentas.

El registro no crea una sesión. El login exige correo verificado, usuario activo y credenciales válidas.

### Login y tokens

`POST /auth/login` devuelve:

```ts
{
  user: {
    id: number;
    nombre: string;
    correo: string;
    activo: boolean;
    rol: 'ADMIN' | 'CLIENT';
    emailVerified: boolean;
    emailVerifiedAt: string | null;
  }
}
```

No devuelve tokens en el body.

El servidor genera internamente:

- un JWT access token en la cookie HTTP-only `cemydi_access`;
- un refresh token aleatorio en la cookie HTTP-only `cemydi_refresh`;
- una cookie CSRF legible llamada `cemydi_csrf`.

El hash del refresh token y el identificador de sesión se almacenan en PostgreSQL. El payload del access token contiene usuario, correo, rol y session ID.

### Cookies

Access y refresh usan:

- `httpOnly: true`;
- `path: /`;
- `secure` dinámico;
- `sameSite: lax` cuando no son seguras;
- `sameSite: none` cuando son seguras.

La cookie CSRF usa los mismos valores de transporte, pero `httpOnly: false`.

No se configura un dominio de cookie explícito.

### Bearer

La estrategia JWT puede extraer el access token desde `cemydi_access` o desde:

```http
Authorization: Bearer <access-token>
```

Esto no constituye por sí solo un flujo móvil completo, porque login no entrega el access token en JSON.

### Persistencia y expiración

- Default de access token: 15 minutos.
- Default de refresh: 7 días.
- Ambos son configurables por entorno; los valores desplegados no se verificaron.
- La sesión se valida contra la tabla de sesiones en cada autenticación.
- Una sesión revocada, expirada o de usuario inactivo se rechaza.
- El refresh token se rota en cada renovación.

### Refresh

`POST /auth/refresh`:

1. obtiene el refresh token exclusivamente de `cemydi_refresh`;
2. busca una sesión activa no expirada;
3. exige usuario activo y correo verificado;
4. rota el refresh token;
5. emite cookies nuevas;
6. devuelve `{ user }`.

No existe soporte confirmado para enviar refresh token por body o Authorization.

### CSRF

Existe un guard CSRF global. Se activa cuando la petición produce cookies `Secure + SameSite=None`.

Para mutaciones no excluidas exige:

- cookie `cemydi_csrf`;
- header `x-csrf-token` con el mismo valor.

`GET /auth/csrf` emite la cookie. Registro, login, refresh, logout, verificación y recuperación están excluidos expresamente del guard.

El guard no distingue actualmente entre autenticación por cookie y Bearer. Una mutación Bearer en producción puede seguir necesitando el double-submit CSRF.

### Sesión actual

`GET /users/me` usa un guard de sesión opcional:

- sin credenciales devuelve `{ user: null }`;
- con sesión válida devuelve perfil, rol, estado y verificación;
- con credenciales presentes pero inválidas puede devolver 401.

### Logout

`POST /auth/logout`:

1. extrae access y refresh de donde están disponibles;
2. limpia las tres cookies;
3. intenta revocar la sesión por access token;
4. intenta revocarla por refresh token;
5. devuelve un mensaje de éxito.

### Roles y rutas

Los únicos roles confirmados son `ADMIN` y `CLIENT`. Las rentas del cliente exigen `CLIENT`. Ocultar UI nunca sustituye los guards del backend.

## CURRENT WEB BEHAVIOR

La web implementa una sesión basada en cookies:

1. login usa `credentials: include`;
2. guarda el usuario solamente en memoria mediante `AuthContext`;
3. elimina claves legacy de `localStorage`, incluido `accessToken`;
4. consulta `/users/me` para hidratar la sesión;
5. usa `apiFetch` para operaciones autenticadas;
6. obtiene CSRF y añade `X-CSRF-Token` en mutaciones;
7. ante 401 intenta una sola llamada compartida a `/auth/refresh`;
8. repite una vez la solicitud original si el refresh funciona.

Los uploads de receta usan `XMLHttpRequest`, `document.cookie`, objetos `File` y eventos del navegador. Este código no es portable directamente a React Native.

La protección `/admin` usa proxy y Server Components de Next.js. No es un patrón de navegación móvil.

## MOBILE ADAPTATION PROPOSAL

### Bloqueo actual

No existe un contrato de sesión nativo completo:

- login no expone tokens;
- refresh solo acepta cookie;
- el guard CSRF puede exigir cookie y header incluso con Bearer;
- el comportamiento de cookies HTTP-only no ha sido validado end-to-end en Android e iOS.

No implementes una capa definitiva de auth móvil hasta que se elija y pruebe una alternativa.

### Alternativa A — cookies

Mantener el contrato actual y usar un cookie jar compatible con Android/iOS.

Requeriría confirmar:

- recepción y envío fiable de `Set-Cookie`/cookies HTTP-only;
- lectura o recuperación del token CSRF no HTTP-only;
- persistencia entre reinicios;
- comportamiento con `SameSite=None; Secure`;
- refresh concurrente;
- logout y limpieza local;
- pruebas en dispositivo físico para ambas plataformas.

Ventaja: menor cambio conceptual al backend.

Riesgo: el flujo depende de comportamiento nativo no validado y posiblemente de una dependencia adicional de cookies.

### Alternativa B — tokens explícitos para cliente nativo

Agregar deliberadamente al backend un contrato móvil que entregue credenciales apropiadas y permita refresh explícito.

Requeriría diseñar:

- endpoint o variante inequívocamente móvil;
- access token de corta duración;
- refresh token rotatorio;
- almacenamiento del refresh token con `expo-secure-store`;
- access token preferentemente en memoria;
- revocación de sesión;
- tratamiento CSRF para requests Bearer autenticados;
- rate limiting, auditoría y compatibilidad con la web existente.

Ventaja: transporte explícito para un cliente no navegador.

Riesgo: requiere cambios de backend, revisión de seguridad y migración contractual controlada.

### Almacenamiento móvil

Si se aprueba la alternativa de tokens:

- usa almacenamiento seguro del sistema para refresh o credencial persistente;
- mantén access token en memoria cuando sea viable;
- nunca uses AsyncStorage para secretos;
- no guardes credenciales en TanStack Query, logs o crash reports;
- borra estado seguro y caché sensible al cerrar sesión.

Si se aprueban cookies, no agregues `expo-secure-store` solo por anticipación.

### Protección de rutas

La navegación móvil debe distinguir:

- sesión desconocida/cargando;
- usuario ausente;
- cliente autenticado;
- sesión expirada;
- rol no permitido.

Los route groups de Expo Router son una ayuda de navegación y UX; la autorización permanece en el backend.

### Refresh y concurrencia

La implementación futura debe:

- permitir un solo refresh simultáneo;
- pausar o coordinar requests que reciben 401;
- repetir como máximo una vez;
- cerrar sesión cuando refresh sea inválido;
- evitar loops de refresh;
- limpiar caché asociada al usuario anterior.

### Background y foreground

Al volver a foreground se debe revalidar la sesión y datos sensibles según la estrategia elegida. No asumas que un token o cookie sigue vigente después de una suspensión prolongada.

## Decisión requerida

Debe aprobarse **Alternativa A — cookies** o **Alternativa B — tokens explícitos** antes de implementar login, persistencia, refresh, cliente autenticado o guards finales en el móvil. Esta documentación no toma esa decisión ni modifica el backend.
