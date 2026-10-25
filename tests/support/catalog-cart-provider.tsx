import type { ReactNode } from 'react';
import { CatalogPreviewProvider as GuestProvider } from '@/providers/catalog-preview-provider';
import { CartProvider } from '@/providers/cart-provider';

/** Matches the guest/remote provider hierarchy in the root layout. */
export function CatalogPreviewProvider({ children }: { children: ReactNode }) {
  return (
    <GuestProvider>
      <CartProvider>{children}</CartProvider>
    </GuestProvider>
  );
}
