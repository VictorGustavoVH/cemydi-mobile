import { jsonResponse } from './auth-api-mock';
import type { Rental } from '@/features/profile/account-service';

export const RENTAL: Rental = {
  id: 'rental-fixture',
  folio: 'REN-123',
  status: 'PENDING',
  createdAt: '2026-10-17T12:00:00.000Z',
  subtotal: 300,
  depositTotal: 200,
  total: 500,
  rejectedReason: null,
  deliveryMethod: 'PICKUP',
  deliveryAddress: null,
  notes: null,
  depositStatus: 'PENDING',
  depositReturnedAmount: 0,
  depositRetainedAmount: 0,
  statusHistory: [],
  items: [
    {
      id: 10,
      productId: 101,
      quantity: 1,
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-04T00:00:00.000Z',
      days: 3,
      lineTotal: 500,
      product: { id: 101, nombre: 'Equipo de prueba', imageUrl: null },
      prescription: null,
    },
  ],
};
export function installAccountApiMock(initial: Rental = RENTAL) {
  let rental = { ...initial };
  const previous = jest.mocked(fetch).getMockImplementation();
  jest.mocked(fetch).mockImplementation(async (input, options) => {
    const url = new URL(String(input));
    if (url.pathname === '/rentals/mine')
      return jsonResponse({
        rentals: [rental],
        pagination: {
          page: Number(url.searchParams.get('page')),
          pageSize: 8,
          total: 1,
          totalPages: 1,
        },
      });
    if (url.pathname === `/rentals/mine/${rental.id}`) return jsonResponse({ rental });
    if (url.pathname === `/rentals/${rental.id}/cancel` && options?.method === 'PATCH') {
      if (rental.status !== 'PENDING')
        return jsonResponse({ message: 'Solo puedes cancelar solicitudes pendientes' }, 400);
      rental = { ...rental, status: 'CANCELLED' };
      return jsonResponse({ message: 'Solicitud de renta cancelada', rental });
    }
    if (url.pathname === '/reviews/mine')
      return jsonResponse({
        reviews: [
          {
            id: 1,
            rating: 4,
            comment: 'Buena atención',
            status: 'APPROVED',
            updatedAt: RENTAL.createdAt,
            product: { id: 101, slug: 'equipo', nombre: 'Equipo de prueba', imageUrl: null },
          },
        ],
      });
    if (url.pathname.startsWith('/legal-documents/'))
      return jsonResponse({
        document: {
          slug: url.pathname.split('/').at(-1),
          title: 'Documento publicado',
          description: 'Contenido del servidor',
          sections: [
            {
              id: 's1',
              title: 'Uso de datos',
              body: '<p>Contenido <strong>legal</strong> &amp; vigente.</p>',
            },
          ],
        },
      });
    if (previous) return previous(input, options);
    throw new Error('Fetch sin fixture');
  });
  return { read: () => rental };
}
