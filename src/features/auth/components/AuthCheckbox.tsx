import { Text, View } from 'react-native';
import type { ReactNode } from 'react';
import Check from 'lucide-react-native/icons/check';
import { AppButton } from '@/components/ui/AppButton';
import { colors } from '@/theme';

type AuthCheckboxProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  error?: string;
  children?: ReactNode;
};
export function AuthCheckbox({
  label,
  checked,
  onChange,
  disabled,
  error,
  children,
}: AuthCheckboxProps) {
  return (
    <View className="gap-1">
      <View className="flex-row items-start">
        <AppButton
          label={label}
          variant="unstyled"
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityHint={error}
          disabled={disabled}
          className={
            children
              ? 'h-11 w-11 shrink-0 items-center justify-center'
              : 'min-h-11 flex-row items-center gap-2'
          }
          onPress={() => onChange(!checked)}
        >
          <View
            className={`h-5 w-5 items-center justify-center rounded border ${checked ? 'border-brand bg-brand' : error ? 'border-danger bg-surface' : 'border-border bg-surface'}`}
          >
            {checked ? (
              <Check aria-hidden color={colors.onBrand} size={15} strokeWidth={3} />
            ) : null}
          </View>
          {!children ? (
            <Text className="flex-shrink font-sans text-sm leading-5 text-secondary">{label}</Text>
          ) : null}
        </AppButton>
        {children ? <View className="min-w-0 flex-1 py-2">{children}</View> : null}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
