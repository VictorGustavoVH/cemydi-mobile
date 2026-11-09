import { z } from 'zod';

export const rentalStatus = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'DELIVERED',
  'RETURNED',
]);
export const rentalLabels = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
  DELIVERED: 'Entregada',
  RETURNED: 'Devuelta',
};
export const rentalSchema = z.object({
  id: z.string().min(1),
  folio: z.string().nullable(),
  status: rentalStatus,
  createdAt: z.iso.datetime(),
  subtotal: z.number(),
  depositTotal: z.number(),
  total: z.number(),
  rejectedReason: z.string().nullable(),
  deliveryMethod: z.enum(['PICKUP', 'HOME_DELIVERY']).nullable(),
  deliveryAddress: z.string().nullable(),
  notes: z.string().nullable(),
  depositStatus: z.enum(['PENDING', 'RETURNED', 'RETAINED', 'PARTIALLY_RETAINED']),
  depositReturnedAmount: z.number(),
  depositRetainedAmount: z.number(),
  statusHistory: z.array(
    z.object({
      id: z.number().int(),
      toStatus: rentalStatus,
      createdAt: z.iso.datetime(),
      note: z.string().nullable(),
    }),
  ),
  items: z.array(
    z.object({
      id: z.number().int(),
      productId: z.number().int(),
      quantity: z.number().int(),
      startDate: z.iso.datetime(),
      endDate: z.iso.datetime(),
      days: z.number().int(),
      lineTotal: z.number(),
      product: z.object({
        id: z.number().int(),
        nombre: z.string(),
        imageUrl: z.string().nullable(),
      }),
      prescription: z
        .object({
          fileName: z.string(),
          status: z.enum(['PENDIENTE', 'EN_REVISION', 'APROBADO', 'RECHAZADO']),
          rejectionReason: z.string().nullable(),
        })
        .nullable(),
    }),
  ),
});
export const rentalsResponseSchema = z.object({
  rentals: z.array(rentalSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().positive(),
  }),
});
export type Rental = z.infer<typeof rentalSchema>;
