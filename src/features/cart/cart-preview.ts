import { getProductPreview, type ProductDetailPreview } from '@/data/product-detail-preview';
import type { PreviewCartItem } from '@/providers/catalog-preview-provider';
import type { ServerCartItem } from './services/cart-service';

export type CartPreviewEntry = {
  item: PreviewCartItem;
  product: ProductDetailPreview;
  remote?: ServerCartItem;
};
export function getCartEntries(items: PreviewCartItem[]): CartPreviewEntry[] {
  return items.flatMap((item) => {
    const product = item.productSnapshot ?? getProductPreview(item.productId);
    return product ? [{ item, product }] : [];
  });
}

const formatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
});
export const formatPreviewMoney = (amount: number) => `${formatter.format(amount)} MXN`;
// Session estimates from presentation data; never a confirmed server cart total.
export const previewAmount = (price: string) => Number(price.replace(/[$,]/g, ''));
export function getPreviewSummary(entries: CartPreviewEntry[]) {
  return entries
    .filter(({ item }) => item.selected)
    .reduce(
      (summary, { item, product }) => ({
        units: summary.units + item.quantity,
        amount:
          summary.amount +
          previewAmount(item.mode === 'rental' ? (product.rental?.price ?? '$0') : product.price) *
            item.quantity,
        deposit:
          summary.deposit +
          (item.mode === 'rental'
            ? previewAmount(product.rental?.deposit ?? '$0') * item.quantity
            : 0),
      }),
      { units: 0, amount: 0, deposit: 0 },
    );
}

export function parseDraftDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T12:00:00Z`);
  return Number(year) >= 1000 &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === iso
    ? iso
    : null;
}
export function formatDraftDateInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
}
export function displayDraftDate(iso: string) {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}
