import type { Href, ImperativeRouter } from 'expo-router';
import type { AuthDestination } from './auth-destination';

const TAB_DESTINATIONS = new Set<AuthDestination>(['/inicio', '/carrito', '/perfil']);

/**
 * Vuelve al destino que el usuario pidió antes de autenticarse.
 *
 * - Sin pantallas que cerrar (llegada directa a /login): reemplaza login por
 *   el destino.
 * - Con login apilado sobre las pestañas: cierra login y cambia de pestaña con
 *   `navigate` para reutilizar el navegador `(tabs)` en lugar de apilar una
 *   segunda copia.
 * - Subrutas de perfil: se apilan sobre las pestañas con `push`, igual que
 *   cualquier otra pantalla de detalle.
 */
export function returnToAuthDestination(router: ImperativeRouter, destination: AuthDestination) {
  const href: Href =
    /^\/perfil\/notificaciones\/[a-zA-Z0-9_-]{1,100}$/.test(destination) &&
    destination !== '/perfil/notificaciones/preferencias'
      ? { pathname: '/perfil/notificaciones/[id]', params: { id: destination.split('/').pop()! } }
      : (destination as Href);
  if (!router.canDismiss()) {
    router.replace(href);
    return;
  }
  router.dismiss();
  if (TAB_DESTINATIONS.has(destination)) {
    router.navigate(href);
  } else {
    router.push(href);
  }
}
