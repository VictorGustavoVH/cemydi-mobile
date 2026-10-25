import { useState } from 'react';
import { Text } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { useCart } from '@/providers/cart-provider';
import { getFriendlyErrorMessage } from '@/services/http/api-error';
import { cartService, couponInputSchema } from '../services/cart-service';
import { useToast } from '@/hooks/useToast';

import X from 'lucide-react-native/icons/x';
import { colors } from '@/theme';

import { useAccountAccess } from '@/hooks/useAccountAccess';

export function CartCouponForm({ onRequireLogin }: { onRequireLogin?: () => void } = {}) {
  const { cart, run, busy, online, uncertain, connected } = useCart();
  const { requestAccess } = useAccountAccess();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const toast = useToast();
  const disabled = connected && (busy || !online || uncertain);
  async function apply() {
    const result = couponInputSchema.safeParse(code.trim());
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    if (!connected) {
      onRequireLogin?.();
      requestAccess('/carrito');
      return;
    }
    try {
      await run(() => cartService.applyCoupon(result.data));
      setError(undefined);
      toast.success('Cupón aplicado');
    } catch (error) {
      setError(getFriendlyErrorMessage(error));
    }
  }
  return (
    <>
      {!connected ? (
        <Text className="font-sans text-sm text-secondary">
          Inicia sesión y guarda tus productos para validar el cupón. No hay descuentos aplicados al
          carrito temporal.
        </Text>
      ) : null}
      {cart?.appliedCoupon ? (
        <Text className="font-sans text-sm text-primary">
          Cupón guardado: {cart.appliedCoupon.code}
        </Text>
      ) : null}
      <AppInput
        label="Código de cupón"
        value={code}
        onChangeText={(text) => {
          setCode(text);
          if (error) setError(undefined);
        }}
        editable={!disabled}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={24}
        error={error}
        onSubmitEditing={() => void apply()}
        trailingAction={
          code.length > 0 ? (
            <AppButton
              className="h-11 w-11 p-0"
              hideLabel
              label="Limpiar código"
              leftIcon={<X aria-hidden color={colors.textSecondary} size={18} />}
              onPress={() => {
                setCode('');
                setError(undefined);
              }}
              variant="ghost"
            />
          ) : null
        }
      />
      <AppButton
        label="Aplicar cupón"
        loading={busy}
        disabled={disabled}
        onPress={() => void apply()}
      />
      {cart?.appliedCoupon ? (
        <AppButton
          label="Quitar cupón"
          variant="secondary"
          disabled={disabled}
          onPress={() =>
            void (async () => {
              try {
                await run(cartService.removeCoupon);
                setError(undefined);
                toast.success('Cupón retirado');
              } catch (error) {
                setError(getFriendlyErrorMessage(error));
              }
            })()
          }
        />
      ) : null}
    </>
  );
}
