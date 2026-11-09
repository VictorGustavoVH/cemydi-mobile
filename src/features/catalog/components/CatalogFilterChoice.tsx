import { View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import X from 'lucide-react-native/icons/x';
import { AppButton } from '@/components/ui/AppButton';
import { colors } from '@/theme';

type CatalogFilterChoiceProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  onClear?: () => void;
  disabled?: boolean;
  single?: boolean;
  compact?: boolean;
};
export function CatalogFilterChoice({
  label,
  selected,
  onPress,
  onClear,
  disabled = false,
  single = false,
  compact = false,
}: CatalogFilterChoiceProps) {
  const clearable = selected && !!onClear;
  return (
    <View className="relative">
      <AppButton
        label={label}
        accessibilityRole={single ? 'radio' : 'checkbox'}
        accessibilityState={{ checked: selected }}
        variant={selected ? 'primary' : compact ? 'outline' : 'secondary'}
        className={`${compact ? 'min-h-11 rounded-full px-4 py-2' : 'justify-start'} ${clearable ? 'pr-12' : ''}`}
        labelClassName={compact ? 'text-sm' : undefined}
        onPress={onPress}
        disabled={disabled}
        leftIcon={
          !compact && selected ? <Check aria-hidden color={colors.onBrand} size={18} /> : undefined
        }
      />
      {clearable ? (
        <AppButton
          label={`Quitar filtro ${label}`}
          hideLabel
          variant="unstyled"
          className="absolute right-0 top-0 h-11 w-11 items-center justify-center"
          disabled={disabled}
          onPress={onClear}
          leftIcon={<X aria-hidden color={colors.onBrand} size={16} />}
        />
      ) : null}
    </View>
  );
}
