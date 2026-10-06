import { Stack } from 'expo-router';
import { CartPreviewScreen } from '@/features/cart/CartPreviewScreen';
export default function CartRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CartPreviewScreen />
    </>
  );
}
