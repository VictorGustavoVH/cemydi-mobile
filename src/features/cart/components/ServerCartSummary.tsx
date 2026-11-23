import { Text, View } from 'react-native';
import { CartCouponButton } from './CartCouponButton';
import type { ServerCart } from '../services/cart-service';
import { formatPreviewMoney } from '../cart-preview';
import { RentalDatesNotice } from './RentalDatesNotice';

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
  const hasRentalItems = cart.items.some((item) => item.mode === 'RENTA');
  const hasPurchaseItems = cart.items.some((item) => item.mode === 'VENTA');

  const rows = [
    ...(hasPurchaseItems || summary.saleSubtotal > 0
      ? [['Subtotal de compra', summary.saleSubtotal] as const]
      : []),
    ...(hasRentalItems || summary.rentalSubtotal > 0
      ? [['Subtotal de renta', summary.rentalSubtotal] as const]
      : []),
    ...(hasRentalItems || summary.rentalDepositTotal > 0
      ? [['Depósitos de renta', summary.rentalDepositTotal] as const]
      : []),
    ...(summary.promotionDiscountTotal > 0
      ? [['Descuentos por promociones', summary.promotionDiscountTotal] as const]
      : []),
    ...(summary.couponDiscountTotal > 0
      ? [['Descuento por cupón', summary.couponDiscountTotal] as const]
      : []),
  ];
  return (
    <View className="mx-5 mt-auto gap-3 border-t border-border/50 pb-2 pt-4">
      <CartCouponButton
        label={cart.appliedCoupon ? `Cupón: ${cart.appliedCoupon.code}` : 'Aplicar cupón'}
        disabled={disabled}
        code={cart.appliedCoupon?.code}
        onPress={onCoupon}
      />
      {hasRentalItems && summary.hasUnconfiguredRentalItems ? <RentalDatesNotice /> : null}
      <View className="gap-2.5">
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
            Este total incluye todo el carrito. Al solicitar la renta se incluirán todos los equipos
            para rentar, aunque selecciones solo algunos.
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
