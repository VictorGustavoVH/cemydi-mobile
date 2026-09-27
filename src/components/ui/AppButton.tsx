import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

import { colors } from '@/theme';

type AppButtonVariant = 'destructive' | 'ghost' | 'outline' | 'primary' | 'secondary';

type AppButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  loading?: boolean;
  variant?: AppButtonVariant;
};

const containerClasses: Record<AppButtonVariant, string> = {
  destructive: 'bg-danger active:opacity-90',
  ghost: 'bg-transparent active:bg-surface-muted',
  outline: 'border border-brand bg-transparent active:bg-surface-muted',
  primary: 'bg-brand-strong active:bg-brand-pressed',
  secondary: 'bg-surface-muted active:opacity-80',
};

const labelClasses: Record<AppButtonVariant, string> = {
  destructive: 'text-on-danger',
  ghost: 'text-brand-strong',
  outline: 'text-brand-strong',
  primary: 'text-on-brand',
  secondary: 'text-primary',
};

const indicatorColors: Record<AppButtonVariant, string> = {
  destructive: colors.onDanger,
  ghost: colors.brandStrong,
  outline: colors.brandStrong,
  primary: colors.onBrand,
  secondary: colors.textPrimary,
};

export function AppButton({
  accessibilityLabel,
  disabled = false,
  label,
  loading = false,
  variant = 'primary',
  ...pressableProps
}: AppButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      {...pressableProps}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      className={`min-h-11 flex-row items-center justify-center gap-2 rounded-xl px-4 py-3 ${containerClasses[variant]} ${isDisabled ? 'opacity-50' : ''}`}
      disabled={isDisabled}
    >
      {loading ? <ActivityIndicator color={indicatorColors[variant]} size="small" /> : null}
      <Text className={`text-base font-semibold ${labelClasses[variant]}`}>{label}</Text>
    </Pressable>
  );
}
