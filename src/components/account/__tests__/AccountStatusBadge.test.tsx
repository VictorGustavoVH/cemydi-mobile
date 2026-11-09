import { render, screen } from '@testing-library/react-native';
import { AccountStatusBadge } from '../AccountStatusBadge';

it.each([
  ['PENDING', 'Pendiente'],
  ['APPROVED', 'Aprobada'],
  ['REJECTED', 'Rechazada'],
  ['CANCELLED', 'Cancelada'],
  ['DELIVERED', 'Entregada'],
  ['RETURNED', 'Devuelta'],
] as const)('presenta el estado de renta %s', async (status, label) => {
  await render(<AccountStatusBadge kind="rental" status={status} />);
  expect(screen.getByText(label)).toBeTruthy();
});

it.each([
  ['PENDING', 'En revisión'],
  ['APPROVED', 'Publicada'],
  ['REJECTED', 'No publicada'],
] as const)('presenta el estado de reseña %s de forma independiente', async (status, label) => {
  await render(<AccountStatusBadge kind="review" status={status} appearance="inline" />);
  expect(screen.getByText(label)).toBeTruthy();
});
