import { type ReactNode } from 'react';
import { Pressable, Text, type PressableProps } from 'react-native';

import { colors } from '@/theme';
import { AppSpinner } from './AppSpinner';

type AppButtonVariant = 'destructive' | 'ghost' | 'outline' | 'primary' | 'secondary' | 'unstyled';

type AppButtonProps = Omit<PressableProps, 'children'> & {
  children?: ReactNode;
  className?: string;
  hideLabel?: boolean;
  label: string;
  labelClassName?: string;
  leftIcon?: ReactNode;
  loading?: boolean;
  rightIcon?: ReactNode;
  variant?: AppButtonVariant;
};

const containerClasses: Record<AppButtonVariant, string> = {
  unstyled: 'active:opacity-70',
  destructive: 'bg-danger active:opacity-90 active:scale-[0.98]',
  ghost: 'bg-transparent active:bg-surface-muted active:scale-[0.98]',
  outline: 'border border-brand-strong bg-transparent active:bg-surface-muted active:scale-[0.98]',
  primary: 'bg-brand-strong active:bg-brand-pressed active:scale-[0.98]',
  secondary: 'bg-surface-muted active:opacity-80 active:scale-[0.98]',
};

const labelClasses: Record<AppButtonVariant, string> = {
  unstyled: 'text-primary',
  destructive: 'text-on-danger',
  ghost: 'text-brand-strong',
  outline: 'text-brand-strong',
  primary: 'text-on-brand',
  secondary: 'text-primary',
};

const indicatorColors: Record<AppButtonVariant, string> = {
  unstyled: colors.textPrimary,
  destructive: colors.onDanger,
  ghost: colors.brandStrong,
  outline: colors.brandStrong,
  primary: colors.onBrand,
  secondary: colors.textPrimary,
};

export function AppButton({
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  children,
  className = '',
  hideLabel = false,
  disabled = false,
  label,
  labelClassName = '',
  leftIcon,
  loading = false,
  rightIcon,
  variant = 'primary',
  ...pressableProps
}: AppButtonProps) {
  const isDisabled = disabled || loading;
  const isUnstyled = variant === 'unstyled';
  const hasCustomRounding = className.includes('rounded-');
  const hasCustomHeight = className.includes('min-h-') || className.includes('h-');

  return (
    <Pressable
      {...pressableProps}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ ...accessibilityState, busy: loading, disabled: isDisabled }}
      className={`${isUnstyled ? '' : 'flex-row items-center justify-center gap-2'} ${isUnstyled ? '' : 'px-4 py-3'} ${hasCustomHeight || isUnstyled ? '' : 'min-h-11'} ${hasCustomRounding || isUnstyled ? '' : 'rounded-xl'} ${containerClasses[variant]} ${isDisabled ? 'opacity-50' : ''} ${className}`}
      disabled={isDisabled}
    >
      {loading ? <AppSpinner color={indicatorColors[variant]} size={18} decorative /> : null}
      {!loading ? leftIcon : null}
      {children ??
        (hideLabel ? null : (
          <Text
            className={`font-sans-semibold text-base ${labelClasses[variant]} ${labelClassName}`}
          >
            {label}
          </Text>
        ))}
      {!loading ? rightIcon : null}
    </Pressable>
  );
}
