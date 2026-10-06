import { createContext, useContext, useState, type ReactNode } from 'react';
import type { CatalogMode } from '@/data/catalog-preview';

export type PreviewCartItem = {
  productId: string;
  mode: Exclude<CatalogMode, 'all'>;
  quantity: number;
  selected: boolean;
  rentalDraft?: RentalDraft;
};
export type RentalDraft = { startDate: string; endDate: string; notes: string };
export const PREVIEW_CART_QUANTITY_LIMIT = 25;
type CatalogPreviewState = {
  favorites: string[];
  items: PreviewCartItem[];
  toggleFavorite: (id: string) => void;
  addItem: (productId: string, mode: PreviewCartItem['mode']) => void;
  removeItem: (productId: string, mode: PreviewCartItem['mode']) => void;
  updateQuantity: (productId: string, mode: PreviewCartItem['mode'], quantity: number) => void;
  toggleSelection: (productId: string, mode: PreviewCartItem['mode']) => void;
  selectMode: (mode: PreviewCartItem['mode'], selected: boolean) => void;
  saveRentalDraft: (productId: string, draft: RentalDraft) => void;
  restoreItem: (item: PreviewCartItem, index: number) => void;
};
const CatalogPreviewContext = createContext<CatalogPreviewState | null>(null);

// Session-only demo state, independent of the authenticated cart API.
export function CatalogPreviewProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [items, setItems] = useState<PreviewCartItem[]>([]);
  return (
    <CatalogPreviewContext.Provider
      value={{
        favorites,
        items,
        toggleFavorite: (id) =>
          setFavorites((current) =>
            current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
          ),
        addItem: (productId, mode) =>
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
                      }
                    : item,
                )
              : [...current, { productId, mode, quantity: 1, selected: true }];
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
            current.map((item) => (item.mode === mode ? { ...item, selected } : item)),
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
                      quantity: Math.min(
                        PREVIEW_CART_QUANTITY_LIMIT,
                        value.quantity + item.quantity,
                      ),
                    }
                  : value,
              );
            const next = [...current];
            next.splice(index, 0, item);
            return next;
          }),
      }}
    >
      {children}
    </CatalogPreviewContext.Provider>
  );
}

export function useCatalogPreview() {
  const context = useContext(CatalogPreviewContext);
  if (!context) throw new Error('CatalogPreviewProvider is required.');
  return context;
}
