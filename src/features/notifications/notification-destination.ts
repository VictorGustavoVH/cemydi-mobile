import type { Href } from 'expo-router';
import type { CustomerNotification } from './notification-schemas';

const numericId = /^\d+$/;

export function notificationDestination(
  item: Pick<CustomerNotification, 'destinationType' | 'destinationId'>,
): Href | null {
  const id = item.destinationId ?? '';
  // Producto y oferta solo existen con ids numéricos del backend. Con otro valor,
  // /producto/[id] cae en el detalle de fixtures y muestra «Producto no encontrado»,
  // así que preferimos no navegar y dejar el aviso en la bandeja.
  if (item.destinationType === 'PRODUCT' && numericId.test(id))
    return { pathname: '/producto/[id]', params: { id } };
  if (item.destinationType === 'RENTAL' && id.length > 0)
    return { pathname: '/perfil/renta/[id]', params: { id } };
  if (item.destinationType === 'PROMOTION' && numericId.test(id))
    return { pathname: '/perfil/oferta/[id]', params: { id } };
  if (item.destinationType === 'ACCOUNT') return '/perfil/seguridad';
  return null;
}
