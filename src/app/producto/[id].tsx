import { Stack, useLocalSearchParams } from 'expo-router';
import { ProductDetailScreen } from '@/features/products/ProductDetailScreen';

export default function ProductDetailRoute() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ProductDetailScreen
        key={`${id}-${mode ?? ''}`}
        productId={id}
        initialMode={mode === 'purchase' || mode === 'rental' ? mode : undefined}
      />
    </>
  );
}
