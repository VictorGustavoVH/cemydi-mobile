import { Text, View } from 'react-native';
import TicketPercent from 'lucide-react-native/icons/ticket-percent';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { AppButton } from '@/components/ui/AppButton';
import { colors } from '@/theme';

type CartCouponButtonProps = {
  label: string;
  code?: string;
  disabled?: boolean;
  onPress: () => void;
};
export function CartCouponButton({
  label,
  code,
  disabled = false,
  onPress,
}: CartCouponButtonProps) {
  return (
    <AppButton
      label={label}
      variant="unstyled"
      disabled={disabled}
      onPress={onPress}
      className="flex-row items-center justify-between rounded-2xl bg-brand/5 px-3 py-2"
    >
      <View className="flex-1 flex-row items-center gap-3">
        <View className="rounded-full bg-brand/10 p-2">
          <TicketPercent
            aria-hidden
            color={disabled ? colors.disabled : colors.brandStrong}
            size={20}
          />
        </View>
        <Text className="flex-1 font-sans-semibold text-sm text-primary">
          {code ? `Cupón: ${code}` : '¿Tienes un cupón?'}
        </Text>
      </View>
      <ChevronRight aria-hidden color={disabled ? colors.disabled : colors.brandStrong} size={18} />
    </AppButton>
  );
}
