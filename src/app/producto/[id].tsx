import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { AppScreen } from '@/components/ui/AppScreen';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConnectedProductDetailScreen } from '@/features/products/ConnectedProductDetailScreen';

export default function ProductDetailRoute() {
  const router = useRouter();
  const { id, mode } = useLocalSearchParams<{ id: string | string[]; mode?: string | string[] }>();
  const productId = typeof id === 'string' ? id : '';
  const valid = /^[1-9]\d*$/.test(productId) && Number.isSafeInteger(Number(productId));
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {valid ? (
        <ConnectedProductDetailScreen
          key={`${productId}-${mode ?? ''}`}
          productId={productId}
          initialMode={mode === 'purchase' || mode === 'rental' ? mode : undefined}
        />
      ) : (
        <AppScreen edges={['top', 'bottom', 'left', 'right']}>
          <EmptyState
            title="Producto no encontrado"
            description="Vuelve al catálogo para elegir otro producto."
            actionLabel="Volver al catálogo"
            onAction={() => router.replace('/catalogo')}
          />
        </AppScreen>
      )}
    </>
  );
}
