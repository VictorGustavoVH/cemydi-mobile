import type { Href, ImperativeRouter } from 'expo-router';
import type { AuthDestination } from './auth-destination';

const TAB_DESTINATIONS = new Set<AuthDestination>(['/inicio', '/carrito', '/perfil']);
const AUTH_ROUTES = new Set(['login', 'register', 'otp', 'forgot-password', 'new-password']);
type AuthNavigationState = { index: number; routes: readonly { name: string }[] };

/** Cancelar conserva la pantalla de origen; el destino privado solo se usa tras autenticar. */
export function cancelAuthFlow(router: ImperativeRouter, state?: AuthNavigationState) {
  if (!router.canDismiss()) {
    router.replace('/inicio');
    return;
  }
  if (
    state &&
    state.routes.slice(0, state.index + 1).every((route) => AUTH_ROUTES.has(route.name))
  ) {
    router.dismissAll();
    router.replace('/inicio');
    return;
  }
  let count = 0;
  if (state) {
    for (let index = state.index; index > 0; index--) {
      if (!AUTH_ROUTES.has(state.routes[index].name)) break;
      count++;
    }
  }
  router.dismiss(Math.max(1, count));
}

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
export function returnToAuthDestination(
  router: ImperativeRouter,
  destination: AuthDestination,
  state?: AuthNavigationState,
) {
  const href: Href =
    /^\/perfil\/notificaciones\/[a-zA-Z0-9_-]{1,100}$/.test(destination) &&
    destination !== '/perfil/notificaciones/preferencias'
      ? { pathname: '/perfil/notificaciones/[id]', params: { id: destination.split('/').pop()! } }
      : (destination as Href);
  if (!router.canDismiss()) {
    router.replace(href);
    return;
  }
  // Registration, OTP and recovery can leave several access screens in the
  // stack. Remove the complete trailing flow while preserving its origin.
  if (
    state &&
    state.routes.slice(0, state.index + 1).every((route) => AUTH_ROUTES.has(route.name))
  ) {
    router.dismissAll();
    router.replace(href);
    return;
  }
  let count = 0;
  if (state) {
    for (let index = state.index; index > 0; index--) {
      if (!AUTH_ROUTES.has(state.routes[index].name)) break;
      count++;
    }
  }
  router.dismiss(Math.max(1, count));
  if (TAB_DESTINATIONS.has(destination)) {
    router.navigate(href);
  } else {
    router.push(href);
  }
}
