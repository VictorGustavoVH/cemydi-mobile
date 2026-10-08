import { Stack, useLocalSearchParams } from 'expo-router';
import { ProductDetailScreen } from '@/features/products/ProductDetailScreen';
import { ConnectedProductDetailScreen } from '@/features/products/ConnectedProductDetailScreen';

export default function ProductDetailRoute() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const DetailScreen = /^\d+$/.test(id) ? ConnectedProductDetailScreen : ProductDetailScreen;
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <DetailScreen
        key={`${id}-${mode ?? ''}`}
        productId={id}
        initialMode={mode === 'purchase' || mode === 'rental' ? mode : undefined}
      />
    </>
  );
}
