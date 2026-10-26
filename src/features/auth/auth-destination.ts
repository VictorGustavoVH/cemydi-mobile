export type AuthDestination =
  | '/inicio'
  | '/carrito'
  | '/perfil'
  | '/perfil/editar'
  | '/perfil/cambiar-correo'
  | '/perfil/seguridad'
  | '/perfil/rentas'
  | '/perfil/resenas'
  | '/perfil/notificaciones'
  | '/perfil/notificaciones/preferencias'
  | `/perfil/notificaciones/${string}`;

const profileDestinations = new Set<AuthDestination>([
  '/perfil',
  '/perfil/editar',
  '/perfil/cambiar-correo',
  '/perfil/seguridad',
  '/perfil/rentas',
  '/perfil/resenas',
  '/perfil/notificaciones',
  '/perfil/notificaciones/preferencias',
]);

export function safeProfileDestination(pathname: string): AuthDestination {
  if (/^\/perfil\/notificaciones\/[a-zA-Z0-9_-]{1,100}$/.test(pathname))
    return pathname as AuthDestination;
  return profileDestinations.has(pathname as AuthDestination)
    ? (pathname as AuthDestination)
    : '/perfil';
}
