import { z } from 'zod';
import { httpClient } from '@/services/http/client';
import { ApiError, isApiError, UserFacingError } from '@/services/http/api-error';
import type { HttpRequestOptions } from '@/services/http/types';

const amount = z.number().nonnegative();
const id = z.number().int().positive();
const date = z.iso.datetime();
const rentalFields = {
  rentalStartDate: z.iso.date().optional(),
  rentalEndDate: z.iso.date().optional(),
  rentalNotes: z.string().max(500).optional(),
};
export const cartUpdateSchema = z.object({
  quantity: z.number().int().min(1).max(25),
  ...rentalFields,
});
export const cartAddSchema = cartUpdateSchema.extend({
  productId: id,
  mode: z.enum(['VENTA', 'RENTA']),
});
export type CartAdd = z.infer<typeof cartAddSchema>;
export type CartUpdate = z.infer<typeof cartUpdateSchema>;
export const couponInputSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{4,24}$/, 'Usa entre 4 y 24 letras, números, guiones o guion bajo.');

export const cartItemSchema = z.object({
  id,
  mode: z.enum(['VENTA', 'RENTA']),
  configurationStatus: z.enum(['PENDING', 'COMPLETE']),
  quantity: z.number().int().positive(),
  rentalStartDate: date.nullable(),
  rentalEndDate: date.nullable(),
  rentalDays: z.number().int().positive().nullable(),
  rentalNotes: z.string().nullable(),
  createdAt: date,
  updatedAt: date,
  lineTotal: amount.nullable(),
  originalLineTotal: amount.optional(),
  discountAmount: amount.optional(),
  finalLineTotal: amount.optional(),
  promotion: z.object({ id, label: z.string(), percent: amount }).nullable(),
  rentalSummary: z
    .object({
      dailyPrice: amount,
      originalDailyPrice: amount,
      minDays: z.number().int().positive(),
      deposit: amount,
      subtotal: amount.nullable(),
      originalSubtotal: amount.nullable(),
      discountAmount: amount,
      depositTotal: amount,
      total: amount.nullable(),
    })
    .nullable(),
  document: z
    .object({
      id: z.uuid(),
      originalFilename: z.string(),
      mimeType: z.string(),
      bytes: z.number().int().nonnegative(),
      status: z.enum(['PENDIENTE', 'EN_REVISION', 'APROBADO', 'RECHAZADO']),
      uploadedAt: date,
      associatedAt: date.nullable(),
    })
    .nullable(),
  availability: z.object({
    isAvailable: z.boolean(),
    maxQuantity: z.number().int().nonnegative(),
    reason: z.string().nullable(),
  }),
  product: z.object({
    id,
    slug: z.string(),
    nombre: z.string(),
    marca: z.string(),
    modelo: z.string(),
    descripcion: z.string(),
    precio: amount,
    clasificacion: z.string(),
    stock: z.number().int(),
    proveedor: z.string(),
    tipoAdquisicion: z.enum(['VENTA', 'RENTA', 'MIXTO']),
    requiereReceta: z.boolean(),
    rentalDailyPrice: z.number().nullable(),
    rentalMinDays: z.number().int().positive(),
    rentalDeposit: amount,
    rentalTerms: z.string().nullable(),
    activo: z.boolean(),
    imageUrl: z.string().nullable(),
  }),
});
export const cartSchema = z.object({
  id: z.string().min(1).nullable(),
  createdAt: date.nullable(),
  updatedAt: date.nullable(),
  appliedCoupon: z
    .object({
      id,
      code: z.string(),
      description: z.string(),
      discountType: z.enum(['PERCENT', 'FIXED']),
      discountValue: amount,
      minimumPurchase: amount,
      maximumDiscount: amount.nullable(),
      discountAmount: amount,
      isValid: z.boolean(),
      reason: z.string().nullable(),
    })
    .nullable(),
  items: z.array(cartItemSchema),
  summary: z.object({
    distinctItems: z.number().int().nonnegative(),
    totalQuantity: z.number().int().nonnegative(),
    subtotal: amount,
    saleSubtotal: amount,
    rentalSubtotal: amount,
    rentalDepositTotal: amount,
    promotionDiscountTotal: amount,
    couponDiscountTotal: amount,
    discountTotal: amount,
    total: amount,
    rentalItems: z.number().int().nonnegative(),
    saleItems: z.number().int().nonnegative(),
    hasUnavailableItems: z.boolean(),
    hasUnconfiguredRentalItems: z.boolean(),
  }),
});
const responseSchema = z.object({ cart: cartSchema });
export type ServerCart = z.infer<typeof cartSchema>;
export type ServerCartItem = z.infer<typeof cartItemSchema>;

const knownCartErrors = new Set([
  'Stock insuficiente',
  'Producto no encontrado',
  'Elemento del carrito no encontrado',
  'El producto no tiene stock disponible',
  'La cantidad solicitada no es valida',
  'La cantidad solicitada supera el stock disponible',
  'El código de cupón no existe',
  'Agrega productos al carrito antes de usar un cupón',
  'Este cupón está desactivado',
  'Este cupón todavía no está vigente',
  'Este cupón ya venció',
  'Este cupón alcanzó su límite de usos',
  'Agrega productos de compra para usar el cupón',
  'El cupón no genera un descuento aplicable',
  'Fecha de renta invalida',
  'Captura juntas la fecha de inicio y la fecha de fin de la renta',
  'La fecha de inicio de renta no puede estar en el pasado',
  'La fecha de fin de renta debe ser posterior o igual al inicio',
]);
function safeCartError(message: string) {
  if (knownCartErrors.has(message)) return message;
  if (/^Compra mínima requerida: \$\d+(?:\.\d{2})?$/.test(message)) return message;
  if (/^La renta minima para este producto es de \d+ dia\(s\)$/.test(message)) return message;
  if (/^Solo se permiten \d+ unidades por producto en el carrito$/.test(message)) return message;
  return 'No pudimos modificar el carrito. Revisa los datos e intenta de nuevo.';
}

async function request(path: string, options: HttpRequestOptions = {}) {
  try {
    const data = await httpClient.request(path, { ...options, authenticated: true });
    const result = responseSchema.safeParse(data);
    if (!result.success) throw new ApiError('El carrito recibido es inválido.', { kind: 'parse' });
    return result.data.cart;
  } catch (error) {
    if (isApiError(error) && [400, 404, 409, 429].includes(error.status ?? 0)) {
      throw new UserFacingError(
        error.status === 429
          ? 'Demasiados intentos. Espera antes de volver a modificar el carrito.'
          : safeCartError(error.message),
      );
    }
    throw error;
  }
}
export const cartService = {
  get: (signal?: AbortSignal) => request('/cart', { signal, cache: 'no-store' }),
  add: (input: CartAdd) =>
    request('/cart/items', { method: 'POST', json: cartAddSchema.parse(input) }),
  update: (itemId: number, input: CartUpdate) =>
    request(`/cart/items/${id.parse(itemId)}`, {
      method: 'PATCH',
      json: cartUpdateSchema.parse(input),
    }),
  remove: (itemId: number) => request(`/cart/items/${id.parse(itemId)}`, { method: 'DELETE' }),
  clear: () => request('/cart', { method: 'DELETE' }),
  clearRentals: () => request('/cart/rentals', { method: 'DELETE' }),
  applyCoupon: (code: string) =>
    request('/cart/coupon', {
      method: 'POST',
      json: { code: couponInputSchema.parse(code.trim()) },
    }),
  removeCoupon: () => request('/cart/coupon', { method: 'DELETE' }),
};
