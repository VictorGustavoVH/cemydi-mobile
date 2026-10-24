import type { PreviewCartItem } from '@/providers/catalog-preview-provider';
import { UserFacingError } from '@/services/http/api-error';
import { cartService, type CartAdd, type ServerCartItem } from './cart-service';

const matches = (item: ServerCartItem, input: CartAdd) =>
  item.product.id === input.productId &&
  item.mode === input.mode &&
  (item.rentalStartDate?.slice(0, 10) ?? undefined) === input.rentalStartDate &&
  (item.rentalEndDate?.slice(0, 10) ?? undefined) === input.rentalEndDate;
let pendingGuestSave = false;
export function markPendingGuestSave() {
  pendingGuestSave = true;
}
export function consumePendingGuestSave() {
  const value = pendingGuestSave;
  pendingGuestSave = false;
  return value;
}

/** Keeps absolute targets in memory so a lost POST response is reconciled through GET before retry. */
export function createCartTransfer() {
  const targets = new Map<string, { input: CartAdd; baseQuantity: number }>();
  return {
    async save(
      items: PreviewCartItem[],
      isCurrent: () => boolean,
      onSaved: (item: PreviewCartItem) => void,
    ) {
      let cart = await cartService.get();
      for (const item of items) {
        if (!isCurrent())
          throw new UserFacingError('La sesión cambió. Vuelve a revisar tus productos.');
        if (!/^\d+$/.test(item.productId))
          throw new UserFacingError(
            'Los productos de muestra no se pueden guardar. Elige productos del catálogo.',
          );
        const key = `${item.productId}:${item.mode}`;
        let plan = targets.get(key);
        if (!plan) {
          const input: CartAdd = {
            productId: Number(item.productId),
            mode: item.mode === 'rental' ? 'RENTA' : 'VENTA',
            quantity: item.quantity,
            ...(item.rentalDraft
              ? {
                  rentalStartDate: item.rentalDraft.startDate,
                  rentalEndDate: item.rentalDraft.endDate,
                  rentalNotes: item.rentalDraft.notes,
                }
              : {}),
          };
          const existing = cart.items.find((line) => matches(line, input));
          const target = { ...input, quantity: (existing?.quantity ?? 0) + input.quantity };
          if (target.quantity > 25)
            throw new UserFacingError(
              'La suma supera 25 unidades. Reduce las cantidades antes de guardar los productos de invitado.',
            );
          plan = { input: target, baseQuantity: existing?.quantity ?? 0 };
          targets.set(key, plan);
        }
        const target = plan.input;
        const existing = cart.items.find((line) => matches(line, target));
        const currentQuantity = existing?.quantity ?? 0;
        if (currentQuantity !== target.quantity) {
          if (currentQuantity !== plan.baseQuantity)
            throw new UserFacingError(
              'El carrito cambió desde el intento anterior. Revisa las cantidades; puedes descartar los productos de invitado y conservar tu carrito guardado.',
            );
          cart = existing
            ? await cartService.update(existing.id, target)
            : await cartService.add(target);
        }
        if (!isCurrent())
          throw new UserFacingError('La sesión cambió. Revisa el carrito de tu cuenta.');
        onSaved(item);
        targets.delete(key);
      }
      return cart;
    },
  };
}
