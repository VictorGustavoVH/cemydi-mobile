import { useId, type ReactNode, type Ref } from 'react';
import { Text, TextInput, type TextInputProps, View } from 'react-native';

import { colors } from '@/theme';
import { useInputVisibility } from './AppScreen';

type AppInputProps = TextInputProps & {
  'aria-invalid'?: boolean;
  className?: string;
  error?: string;
  helperText?: string;
  label: string;
  hideLabel?: boolean;
  leadingIcon?: ReactNode;
  trailingAction?: ReactNode;
  labelAction?: ReactNode;
  valid?: boolean;
  unstyled?: boolean;
  ref?: Ref<TextInput>;
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
  trailingAction,
  labelAction,
  valid = false,
  unstyled = false,
  ref,
  nativeID,
  ...textInputProps
}: AppInputProps) {
  const generatedId = useId();
  const inputVisibility = useInputVisibility();
  const inputId = nativeID ?? generatedId;
  const feedback = error ?? helperText;

  return (
    <View className="gap-2">
      {!hideLabel ? (
        <View className="flex-row items-center gap-1">
          <Text
            className="flex-shrink font-sans-semibold text-base text-primary"
            nativeID={`${inputId}-label`}
          >
            {label}
          </Text>
          {labelAction}
        </View>
      ) : null}
      <View className="relative justify-center">
        {leadingIcon ? (
          <View pointerEvents="none" className="absolute left-3 z-10">
            {leadingIcon}
          </View>
        ) : null}
        <TextInput
          {...textInputProps}
          onFocus={(event) => {
            inputVisibility?.focus(event.target);
            textInputProps.onFocus?.(event);
          }}
          onBlur={(event) => {
            inputVisibility?.blur(event.target);
            textInputProps.onBlur?.(event);
          }}
          ref={ref}
          maxFontSizeMultiplier={textInputProps.maxFontSizeMultiplier ?? 1.3}
          accessibilityHint={
            accessibilityHint ?? feedback ?? (valid ? 'Formato válido' : undefined)
          }
          accessibilityLabel={accessibilityLabel ?? label}
          aria-invalid={error ? true : (textInputProps['aria-invalid'] ?? false)}
          className={`${unstyled ? '' : `min-h-12 rounded-xl border bg-surface px-4 py-3 font-sans text-base text-primary ${leadingIcon ? 'pl-11' : ''} ${error ? 'border-danger' : valid ? '' : 'border-border focus:border-brand'} ${trailingAction ? 'pr-14' : ''}`} ${editable ? '' : 'opacity-50'} ${className}`}
          style={[
            !unstyled && (error || valid)
              ? {
                  borderColor: error ? colors.inputError : colors.brand,
                  borderWidth: error ? 2 : 1,
                }
              : undefined,
            textInputProps.style,
          ]}
          editable={editable}
          nativeID={inputId}
          placeholderTextColor={colors.textSecondary}
        />
        {trailingAction ? <View className="absolute right-1">{trailingAction}</View> : null}
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
