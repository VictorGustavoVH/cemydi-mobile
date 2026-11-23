import { Text, View } from 'react-native';
import Minus from 'lucide-react-native/icons/minus';
import Plus from 'lucide-react-native/icons/plus';
import { AppButton } from './AppButton';
import { colors } from '@/theme';

type QuantityStepperProps = {
  value: number;
  max: number;
  disabled?: boolean;
  subject: string;
  onChange: (value: number) => void;
};

export function QuantityStepper({
  value,
  max,
  disabled = false,
  subject,
  onChange,
}: QuantityStepperProps) {
  return (
    <View className="flex-row items-center rounded-full border border-border-subtle bg-surface">
      <AppButton
        label={`Reducir cantidad ${subject}`}
        hideLabel
        variant="ghost"
        className="h-11 w-11 rounded-full px-0 py-0"
        disabled={disabled || value <= 1}
        onPress={() => onChange(value - 1)}
        leftIcon={
          <Minus
            aria-hidden
            size={16}
            color={disabled || value <= 1 ? colors.disabled : colors.textPrimary}
          />
        }
      />
      <Text
        accessibilityLabel={`Cantidad ${subject}: ${value}`}
        accessibilityLiveRegion="polite"
        className="min-w-5 text-center font-sans-semibold text-sm text-primary"
      >
        {value}
      </Text>
      <AppButton
        label={`Aumentar cantidad ${subject}`}
        hideLabel
        variant="ghost"
        className="h-11 w-11 rounded-full px-0 py-0"
        disabled={disabled || value >= max}
        onPress={() => onChange(value + 1)}
        leftIcon={
          <Plus
            aria-hidden
            size={16}
            color={disabled || value >= max ? colors.disabled : colors.textPrimary}
          />
        }
      />
    </View>
  );
}
