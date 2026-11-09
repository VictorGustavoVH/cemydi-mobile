import type { ReactNode } from 'react';
import { CatalogPreviewProvider as GuestProvider } from '@/providers/catalog-preview-provider';
import { CartProvider, type CartSyncScreen } from '@/providers/cart-provider';

/** Matches the guest/remote provider hierarchy in the root layout. */
export function CatalogPreviewProvider({
  children,
  syncScreen,
}: {
  children: ReactNode;
  syncScreen?: CartSyncScreen;
}) {
  return (
    <GuestProvider>
      <CartProvider syncScreen={syncScreen}>{children}</CartProvider>
    </GuestProvider>
  );
}
