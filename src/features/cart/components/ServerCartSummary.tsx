import { Text, View } from 'react-native';
import { CartCouponButton } from './CartCouponButton';
import type { ServerCart } from '../services/cart-service';
import { formatPreviewMoney } from '../cart-preview';

export function ServerCartSummary({
  cart,
  partialSelection,
  disabled,
  onCoupon,
}: {
  cart: ServerCart;
  partialSelection: boolean;
  disabled: boolean;
  onCoupon: () => void;
}) {
  const summary = cart.summary;
  const rows = [
    ['Subtotal de compra', summary.saleSubtotal],
    ['Subtotal de renta', summary.rentalSubtotal],
    ['Depósitos de renta', summary.rentalDepositTotal],
    ['Descuentos por promociones', summary.promotionDiscountTotal],
    ['Descuento por cupón', summary.couponDiscountTotal],
  ] as const;
  return (
    <View className="mx-5 mt-6 gap-4 border-t border-border/50 pb-6 pt-5">
      <CartCouponButton
        label={cart.appliedCoupon ? `Cupón: ${cart.appliedCoupon.code}` : 'Aplicar cupón'}
        disabled={disabled}
        code={cart.appliedCoupon?.code}
        onPress={onCoupon}
      />
      <View className="gap-2.5 border-t border-border/40 pt-4">
        <Text accessibilityRole="header" className="font-sans-semibold text-base text-primary">
          Resumen del carrito completo
        </Text>
        {rows.map(([label, value]) => (
          <View key={label} className="flex-row flex-wrap justify-between gap-2">
            <Text className="font-sans text-sm text-secondary">{label}</Text>
            <Text
              accessibilityLabel={`${label}: ${formatPreviewMoney(value)}`}
              className="font-sans-semibold text-sm text-primary"
            >
              {formatPreviewMoney(value)}
            </Text>
          </View>
        ))}
        <Text accessibilityLiveRegion="polite" className="font-sans-semibold text-lg text-primary">
          Total: {formatPreviewMoney(summary.total)}
        </Text>
        {cart.appliedCoupon && !cart.appliedCoupon.isValid ? (
          <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-danger">
            {cart.appliedCoupon.reason ?? 'El cupón ya no es válido.'}
          </Text>
        ) : null}
        {partialSelection ? (
          <Text className="font-sans text-sm text-secondary">
            La selección solo cambia la revisión. Este total incluye todos los productos guardados.
          </Text>
        ) : null}
        {summary.hasUnconfiguredRentalItems ? (
          <Text className="font-sans text-sm text-secondary">
            El total está incompleto: configura las fechas de las rentas pendientes.
          </Text>
        ) : null}
        {summary.hasUnavailableItems ? (
          <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-danger">
            Hay productos no disponibles. Actualiza cantidades o elimínalos.
          </Text>
        ) : null}
      </View>
    </View>
  );
}
