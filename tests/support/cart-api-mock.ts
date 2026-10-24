import type { ServerCart, ServerCartItem } from '@/features/cart/services/cart-service';
import { cartSchema } from '@/features/cart/services/cart-service';
import { z } from 'zod';
import { jsonResponse } from './auth-api-mock';

const time = '2026-10-16T12:00:00.000Z';
export const CART_LINE: ServerCartItem = {
  id: 7,
  mode: 'VENTA',
  configurationStatus: 'COMPLETE',
  quantity: 2,
  rentalStartDate: null,
  rentalEndDate: null,
  rentalDays: null,
  rentalNotes: null,
  createdAt: time,
  updatedAt: time,
  lineTotal: 1000,
  originalLineTotal: 1200,
  finalLineTotal: 1000,
  discountAmount: 200,
  promotion: null,
  rentalSummary: null,
  document: null,
  availability: { isAvailable: true, maxQuantity: 6, reason: null },
  product: {
    id: 101,
    slug: 'silla',
    nombre: 'Silla de ruedas',
    marca: 'Fixture',
    modelo: 'Prueba',
    descripcion: 'Descripción de prueba',
    precio: 600,
    clasificacion: 'Movilidad',
    stock: 6,
    proveedor: 'Fixture',
    tipoAdquisicion: 'MIXTO',
    requiereReceta: false,
    rentalDailyPrice: 45,
    rentalMinDays: 3,
    rentalDeposit: 500,
    rentalTerms: 'Condiciones',
    activo: true,
    imageUrl: null,
  },
};
export const RENTAL_LINE: ServerCartItem = {
  ...CART_LINE,
  id: 8,
  mode: 'RENTA',
  quantity: 1,
  configurationStatus: 'PENDING',
  lineTotal: null,
  originalLineTotal: undefined,
  finalLineTotal: undefined,
  discountAmount: undefined,
  rentalSummary: {
    dailyPrice: 40,
    originalDailyPrice: 45,
    minDays: 3,
    deposit: 500,
    subtotal: null,
    originalSubtotal: null,
    discountAmount: 0,
    depositTotal: 500,
    total: null,
  },
};
export const CART_RESPONSE: ServerCart = {
  id: 'cart-fixture',
  createdAt: time,
  updatedAt: time,
  appliedCoupon: null,
  items: [CART_LINE, RENTAL_LINE],
  summary: {
    distinctItems: 2,
    totalQuantity: 3,
    subtotal: 1200,
    saleSubtotal: 1200,
    rentalSubtotal: 0,
    rentalDepositTotal: 0,
    promotionDiscountTotal: 200,
    couponDiscountTotal: 0,
    discountTotal: 200,
    total: 1000,
    rentalItems: 1,
    saleItems: 1,
    hasUnavailableItems: false,
    hasUnconfiguredRentalItems: true,
  },
};

export function installCartApiMock(initial: ServerCart = CART_RESPONSE) {
  const cart = cartSchema.parse(JSON.parse(JSON.stringify(initial)));
  const previous = jest.mocked(fetch).getMockImplementation();
  jest.mocked(fetch).mockImplementation(async (input, options) => {
    const path = new URL(String(input)).pathname;
    if (!path.startsWith('/cart')) {
      if (previous) return previous(input, options);
      throw new Error('Fetch sin fixture');
    }
    const body = z
      .record(z.string(), z.union([z.string(), z.number()]))
      .parse(JSON.parse(String(options?.body ?? '{}')));
    const method = options?.method ?? 'GET';
    if (path === '/cart/coupon') {
      if (method === 'DELETE') cart.appliedCoupon = null;
      else if (body.code !== 'AHORRO')
        return jsonResponse({ message: 'El código de cupón no existe' }, 400);
      else {
        cart.appliedCoupon = {
          id: 1,
          code: 'AHORRO',
          description: 'Fixture',
          discountType: 'FIXED',
          discountValue: 77,
          minimumPurchase: 0,
          maximumDiscount: null,
          discountAmount: 77,
          isValid: true,
          reason: null,
        };
      }
      cart.summary.couponDiscountTotal = cart.appliedCoupon ? 77 : 0;
      cart.summary.total = cart.appliedCoupon ? 923 : 1000;
    } else if (path === '/cart/items' && method === 'POST') {
      const existing = cart.items.find(
        (item) =>
          item.product.id === body.productId &&
          item.mode === body.mode &&
          (item.rentalStartDate?.slice(0, 10) ?? undefined) === body.rentalStartDate &&
          (item.rentalEndDate?.slice(0, 10) ?? undefined) === body.rentalEndDate,
      );
      if (existing) existing.quantity += Number(body.quantity);
      else
        cart.items.push({
          ...(body.mode === 'RENTA' ? RENTAL_LINE : CART_LINE),
          id: Math.max(0, ...cart.items.map((item) => item.id)) + 1,
          quantity: Number(body.quantity),
          mode: body.mode === 'RENTA' ? 'RENTA' : 'VENTA',
          rentalStartDate: body.rentalStartDate ? `${body.rentalStartDate}T00:00:00.000Z` : null,
          rentalEndDate: body.rentalEndDate ? `${body.rentalEndDate}T00:00:00.000Z` : null,
          rentalNotes: typeof body.rentalNotes === 'string' ? body.rentalNotes : null,
          configurationStatus:
            body.mode === 'RENTA' && !body.rentalStartDate ? 'PENDING' : 'COMPLETE',
          product: { ...CART_LINE.product, id: Number(body.productId) },
        });
    } else if (/^\/cart\/items\/\d+$/.test(path)) {
      const id = Number(path.split('/').at(-1));
      if (method === 'DELETE') cart.items = cart.items.filter((item) => item.id !== id);
      if (method === 'PATCH') {
        const item = cart.items.find((item) => item.id === id);
        if (item) {
          item.quantity = Number(body.quantity);
          if (body.rentalStartDate) {
            item.rentalStartDate = `${body.rentalStartDate}T00:00:00.000Z`;
            item.rentalEndDate = `${body.rentalEndDate}T00:00:00.000Z`;
            item.rentalNotes = String(body.rentalNotes ?? '');
            item.configurationStatus = 'COMPLETE';
          }
        }
      }
    } else if (path === '/cart' && method === 'DELETE') cart.items = [];
    else if (path === '/cart/rentals' && method === 'DELETE')
      cart.items = cart.items.filter((item) => item.mode !== 'RENTA');
    cart.summary.totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    return jsonResponse({ cart });
  });
  return { read: () => cart };
}
