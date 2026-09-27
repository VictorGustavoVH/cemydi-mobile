import { useId } from 'react';
import { Text, TextInput, type TextInputProps, View } from 'react-native';

import { colors } from '@/theme';

type AppInputProps = TextInputProps & {
  className?: string;
  error?: string;
  helperText?: string;
  label: string;
};

export function AppInput({
  accessibilityHint,
  accessibilityLabel,
  className = '',
  editable = true,
  error,
  helperText,
  label,
  nativeID,
  ...textInputProps
}: AppInputProps) {
  const generatedId = useId();
  const inputId = nativeID ?? generatedId;
  const feedback = error ?? helperText;

  return (
    <View className="gap-2">
      <Text className="text-base font-semibold text-primary" nativeID={`${inputId}-label`}>
        {label}
      </Text>
      <TextInput
        {...textInputProps}
        accessibilityHint={accessibilityHint ?? feedback}
        accessibilityLabel={accessibilityLabel ?? label}
        aria-invalid={Boolean(error)}
        className={`min-h-11 rounded-xl border bg-surface px-4 py-3 text-base text-primary ${
          error ? 'border-danger' : 'border-border focus:border-brand'
        } ${editable ? '' : 'opacity-50'} ${className}`}
        editable={editable}
        nativeID={inputId}
        placeholderTextColor={colors.textSecondary}
      />
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
