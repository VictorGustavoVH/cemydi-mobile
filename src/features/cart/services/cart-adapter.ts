import type { ProductDetailPreview } from '@/data/product-detail-preview';
import type { PreviewCartItem } from '@/providers/catalog-preview-provider';
import { formatProductMoney } from '@/services/products/product-adapter';
import type { ServerCartItem } from './cart-service';
import type { CartPreviewEntry } from '../cart-preview';

const cache = new WeakMap<ServerCartItem, CartPreviewEntry>();
export function toCartEntry(remote: ServerCartItem): CartPreviewEntry {
  const existing = cache.get(remote);
  if (existing) return existing;
  const product = remote.product;
  const snapshot: ProductDetailPreview = {
    id: String(product.id),
    name: product.nombre,
    categoryId: product.clasificacion,
    category: product.clasificacion,
    description: product.descripcion,
    characteristics: [],
    caption: product.marca,
    image: product.imageUrl ? { uri: product.imageUrl } : undefined,
    modes:
      product.tipoAdquisicion === 'MIXTO'
        ? ['purchase', 'rental']
        : product.tipoAdquisicion === 'RENTA'
          ? ['rental']
          : ['purchase'],
    price: formatProductMoney(
      remote.mode === 'VENTA' && remote.finalLineTotal !== undefined
        ? remote.finalLineTotal / remote.quantity
        : product.precio,
    ),
    prescription: product.requiereReceta,
    unavailable: !remote.availability.isAvailable,
    ...(remote.rentalSummary
      ? {
          rental: {
            price: formatProductMoney(remote.rentalSummary.dailyPrice),
            minimum: `${remote.rentalSummary.minDays} días`,
            deposit: formatProductMoney(remote.rentalSummary.deposit),
            terms: product.rentalTerms ?? '',
          },
        }
      : {}),
  };
  const item: PreviewCartItem = {
    serverId: remote.id,
    productId: String(product.id),
    mode: remote.mode === 'RENTA' ? 'rental' : 'purchase',
    quantity: remote.quantity,
    selected: true,
    productSnapshot: snapshot,
    ...(remote.rentalStartDate && remote.rentalEndDate
      ? {
          rentalDraft: {
            startDate: remote.rentalStartDate.slice(0, 10),
            endDate: remote.rentalEndDate.slice(0, 10),
            notes: remote.rentalNotes ?? '',
          },
        }
      : {}),
  };
  const entry = { item, product: snapshot, remote };
  cache.set(remote, entry);
  return entry;
}
