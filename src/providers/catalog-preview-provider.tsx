import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { CatalogMode } from '@/data/catalog-preview';
import type { ProductDetailPreview } from '@/data/product-detail-preview';

export type PreviewCartItem = {
  serverId?: number;
  productId: string;
  mode: Exclude<CatalogMode, 'all'>;
  quantity: number;
  selected: boolean;
  rentalDraft?: RentalDraft;
  productSnapshot?: ProductDetailPreview;
};
export type RentalDraft = { startDate: string; endDate: string; notes: string };
export const PREVIEW_CART_QUANTITY_LIMIT = 25;
type CatalogPreviewState = {
  favorites: string[];
  items: PreviewCartItem[];
  toggleFavorite: (id: string) => void;
  addItem: (
    productId: string,
    mode: PreviewCartItem['mode'],
    productSnapshot?: ProductDetailPreview,
  ) => void;
  removeItem: (productId: string, mode: PreviewCartItem['mode'], serverId?: number) => void;
  updateQuantity: (
    productId: string,
    mode: PreviewCartItem['mode'],
    quantity: number,
    serverId?: number,
  ) => void;
  toggleSelection: (productId: string, mode: PreviewCartItem['mode'], serverId?: number) => void;
  selectMode: (mode: PreviewCartItem['mode'], selected: boolean) => void;
  saveRentalDraft: (productId: string, draft: RentalDraft, serverId?: number) => void;
  restoreItem: (item: PreviewCartItem, index: number) => void;
};
type CatalogPreviewActions = Omit<CatalogPreviewState, 'favorites' | 'items'>;
const CatalogPreviewActionsContext = createContext<CatalogPreviewActions | null>(null);
const CatalogPreviewContext = createContext<CatalogPreviewState | null>(null);

// Session-only demo state, independent of the authenticated cart API.
export function CatalogPreviewProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [items, setItems] = useState<PreviewCartItem[]>([]);
  const actions = useMemo<CatalogPreviewActions>(
    () => ({
      toggleFavorite: (id) =>
        setFavorites((current) =>
          current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
        ),
      addItem: (productId, mode, productSnapshot) =>
        setItems((current) => {
          const existing = current.find(
            (item) => item.productId === productId && item.mode === mode,
          );
          return existing
            ? current.map((item) =>
                item === existing
                  ? {
                      ...item,
                      selected: true,
                      quantity: Math.min(PREVIEW_CART_QUANTITY_LIMIT, item.quantity + 1),
                      ...(productSnapshot ? { productSnapshot } : {}),
                    }
                  : item,
              )
            : [
                ...current,
                {
                  productId,
                  mode,
                  quantity: 1,
                  selected: true,
                  ...(productSnapshot ? { productSnapshot } : {}),
                },
              ];
        }),
      removeItem: (productId, mode) =>
        setItems((current) =>
          current.filter((item) => item.productId !== productId || item.mode !== mode),
        ),
      updateQuantity: (productId, mode, quantity) => {
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > PREVIEW_CART_QUANTITY_LIMIT)
          return;
        setItems((current) =>
          current.map((item) =>
            item.productId === productId && item.mode === mode ? { ...item, quantity } : item,
          ),
        );
      },
      toggleSelection: (productId, mode) =>
        setItems((current) =>
          current.map((item) =>
            item.productId === productId && item.mode === mode
              ? { ...item, selected: !item.selected }
              : item,
          ),
        ),
      selectMode: (mode, selected) =>
        setItems((current) =>
          current.map((item) =>
            item.mode === mode && item.selected !== selected ? { ...item, selected } : item,
          ),
        ),
      saveRentalDraft: (productId, rentalDraft) =>
        setItems((current) =>
          current.map((item) =>
            item.productId === productId && item.mode === 'rental'
              ? { ...item, rentalDraft }
              : item,
          ),
        ),
      restoreItem: (item, index) =>
        setItems((current) => {
          const existing = current.find(
            (value) => value.productId === item.productId && value.mode === item.mode,
          );
          if (existing)
            return current.map((value) =>
              value === existing
                ? {
                    ...value,
                    quantity: Math.min(PREVIEW_CART_QUANTITY_LIMIT, value.quantity + item.quantity),
                  }
                : value,
            );
          const next = [...current];
          next.splice(index, 0, item);
          return next;
        }),
    }),
    [],
  );
  const value = useMemo(() => ({ favorites, items, ...actions }), [favorites, items, actions]);
  return (
    <CatalogPreviewActionsContext.Provider value={actions}>
      <CatalogPreviewContext.Provider value={value}>{children}</CatalogPreviewContext.Provider>
    </CatalogPreviewActionsContext.Provider>
  );
}

export function useCatalogPreview() {
  const context = useContext(CatalogPreviewContext);
  if (!context) throw new Error('CatalogPreviewProvider is required.');
  return context;
}

export function useOptionalCatalogPreview() {
  return useContext(CatalogPreviewContext);
}

/** Action-only consumers do not subscribe to cart/favorite changes. */
export function useCatalogPreviewActions() {
  const actions = useContext(CatalogPreviewActionsContext);
  if (!actions) throw new Error('CatalogPreviewProvider is required.');
  return actions;
}
