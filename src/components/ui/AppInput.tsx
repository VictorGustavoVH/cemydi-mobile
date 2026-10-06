import { useId, type ReactNode } from 'react';
import { Text, TextInput, type TextInputProps, View } from 'react-native';

import { colors } from '@/theme';

type AppInputProps = TextInputProps & {
  className?: string;
  error?: string;
  helperText?: string;
  label: string;
  hideLabel?: boolean;
  leadingIcon?: ReactNode;
};

export function AppInput({
  accessibilityHint,
  accessibilityLabel,
  className = '',
  editable = true,
  error,
  helperText,
  label,
  hideLabel = false,
  leadingIcon,
  nativeID,
  ...textInputProps
}: AppInputProps) {
  const generatedId = useId();
  const inputId = nativeID ?? generatedId;
  const feedback = error ?? helperText;

  return (
    <View className="gap-2">
      {!hideLabel ? (
        <Text className="font-sans-semibold text-base text-primary" nativeID={`${inputId}-label`}>
          {label}
        </Text>
      ) : null}
      <View className="relative justify-center">
        {leadingIcon ? (
          <View pointerEvents="none" className="absolute left-3 z-10">
            {leadingIcon}
          </View>
        ) : null}
        <TextInput
          {...textInputProps}
          accessibilityHint={accessibilityHint ?? feedback}
          accessibilityLabel={accessibilityLabel ?? label}
          aria-invalid={Boolean(error)}
          className={`min-h-11 rounded-xl border bg-surface px-4 py-3 font-sans text-base text-primary ${leadingIcon ? 'pl-11' : ''} ${
            error ? 'border-danger' : 'border-border focus:border-brand'
          } ${editable ? '' : 'opacity-50'} ${className}`}
          editable={editable}
          nativeID={inputId}
          placeholderTextColor={colors.textSecondary}
        />
      </View>
      {feedback ? (
        <Text
          accessibilityLiveRegion={error ? 'polite' : 'none'}
          className={`text-sm ${error ? 'text-danger' : 'text-secondary'}`}
          nativeID={`${inputId}-feedback`}
        >
          {feedback}
        </Text>
      ) : null}
    </View>
  );
}
