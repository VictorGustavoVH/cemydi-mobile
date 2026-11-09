import { useId, useState, type ReactNode, type Ref } from 'react';
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
  labelTrailingAction?: ReactNode;
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
  labelTrailingAction,
  valid,
  unstyled = false,
  ref,
  nativeID,
  ...textInputProps
}: AppInputProps) {
  const generatedId = useId();
  const inputVisibility = useInputVisibility();
  const inputId = nativeID ?? generatedId;
  const feedback = error ?? helperText;
  const [localValue, setLocalValue] = useState(textInputProps.defaultValue ?? '');
  const filled = Boolean((textInputProps.value ?? localValue).trim());
  const invalid = Boolean(error || textInputProps['aria-invalid']);
  const highlighted = !invalid && (valid ?? filled);

  return (
    <View
      className="min-w-0 max-w-full shrink gap-2"
      style={labelTrailingAction ? { rowGap: 4 } : undefined}
    >
      {!hideLabel ? (
        <View
          className={`flex-row flex-wrap gap-x-1 gap-y-1 ${labelTrailingAction ? 'items-end' : 'items-center'}`}
        >
          <Text
            className="flex-shrink font-sans-semibold text-base text-primary"
            nativeID={`${inputId}-label`}
            style={labelTrailingAction ? { includeFontPadding: false } : undefined}
          >
            {label}
          </Text>
          {labelAction}
          {labelTrailingAction ? (
            <View className="ml-auto max-w-full shrink">{labelTrailingAction}</View>
          ) : null}
        </View>
      ) : null}
      <View className="relative min-w-0 max-w-full justify-center">
        {leadingIcon ? (
          <View pointerEvents="none" className="absolute left-3 z-10">
            {leadingIcon}
          </View>
        ) : null}
        <TextInput
          {...textInputProps}
          onChangeText={(text) => {
            if (textInputProps.value === undefined) setLocalValue(text);
            textInputProps.onChangeText?.(text);
          }}
          onFocus={(event) => {
            inputVisibility?.focus(event.target);
            textInputProps.onFocus?.(event);
          }}
          onBlur={(event) => {
            inputVisibility?.blur(event.target);
            textInputProps.onBlur?.(event);
          }}
          ref={ref}
          accessibilityHint={
            accessibilityHint ??
            feedback ??
            (highlighted ? (valid === true ? 'Formato válido' : 'Campo completado') : undefined)
          }
          accessibilityLabel={accessibilityLabel ?? label}
          aria-invalid={error ? true : (textInputProps['aria-invalid'] ?? false)}
          className={`${unstyled ? '' : `min-h-12 rounded-xl border bg-surface px-4 py-3 font-sans text-base text-primary ${leadingIcon ? 'pl-11' : ''} ${invalid ? 'border-danger' : highlighted ? '' : 'border-border focus:border-brand'} ${trailingAction ? 'pr-14' : ''}`} ${editable ? '' : 'opacity-50'} ${className}`}
          style={[
            !unstyled
              ? {
                  minWidth: 0,
                  width: '100%',
                  flexShrink: 1,
                  borderWidth: 1,
                  ...(textInputProps.multiline
                    ? { height: 120, maxHeight: 160, textAlignVertical: 'top' as const }
                    : {}),
                }
              : undefined,
            textInputProps.style,
            !unstyled && (invalid || highlighted)
              ? { borderColor: invalid ? colors.inputError : colors.brand }
              : undefined,
          ]}
          scrollEnabled={textInputProps.scrollEnabled ?? true}
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
