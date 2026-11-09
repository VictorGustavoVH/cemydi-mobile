export type AuthDestination =
  | '/inicio'
  | '/carrito'
  | '/perfil'
  | '/perfil/editar'
  | '/perfil/cambiar-correo'
  | '/perfil/seguridad'
  | '/perfil/cambiar-contrasena'
  | '/perfil/eliminar-cuenta'
  | '/perfil/rentas'
  | '/perfil/resenas'
  | `/perfil/resenas/${number}`
  | '/perfil/notificaciones'
  | '/perfil/notificaciones/preferencias'
  | `/perfil/notificaciones/${string}`;

const profileDestinations = new Set<AuthDestination>([
  '/perfil',
  '/perfil/editar',
  '/perfil/cambiar-correo',
  '/perfil/seguridad',
  '/perfil/cambiar-contrasena',
  '/perfil/eliminar-cuenta',
  '/perfil/rentas',
  '/perfil/resenas',
  '/perfil/notificaciones',
  '/perfil/notificaciones/preferencias',
]);

export function safeProfileDestination(pathname: string): AuthDestination {
  if (
    /^\/perfil\/resenas\/[1-9]\d*$/.test(pathname) &&
    Number.isSafeInteger(Number(pathname.split('/').pop()))
  )
    return pathname as AuthDestination;
  if (/^\/perfil\/notificaciones\/[a-zA-Z0-9_-]{1,100}$/.test(pathname))
    return pathname as AuthDestination;
  return profileDestinations.has(pathname as AuthDestination)
    ? (pathname as AuthDestination)
    : '/perfil';
}
