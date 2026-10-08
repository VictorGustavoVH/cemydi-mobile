import { useState, type Ref } from 'react';
import { Platform, Text, View, useWindowDimensions, type TextInput } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { AppInput } from '@/components/ui/AppInput';
import { colors } from '@/theme';
import { OTP_LENGTH } from '../schemas/auth-schemas';

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  verified?: boolean;
  onBlur?: () => void;
  ref?: Ref<TextInput>;
};
export function OtpInput({
  value,
  onChange,
  error,
  disabled = false,
  verified = false,
  onBlur,
  ref,
}: OtpInputProps) {
  const { fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const [cursor, setCursor] = useState(0);
  const height = Math.max(52, 32 * fontScale + 16);
  return (
    <View className="gap-2">
      <Text className="font-sans-semibold text-base text-primary">Código de verificación</Text>
      <View style={{ position: 'relative', minHeight: height }}>
        <View
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            flexDirection: 'row',
            gap: 4,
            width: '100%',
            zIndex: 1,
            backgroundColor: colors.background,
          }}
        >
          {Array.from({ length: OTP_LENGTH }, (_, index) => {
            const active = focused && index === Math.min(cursor, OTP_LENGTH - 1);
            return (
              <Animated.View
                key={index}
                testID={`otp-cell-${index}`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height,
                  borderRadius: 10,
                  borderWidth: active || error ? 2 : 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderColor: verified
                    ? colors.success
                    : error
                      ? colors.inputError
                      : active
                        ? colors.focus
                        : colors.border,
                  backgroundColor: verified
                    ? colors.successMuted
                    : active
                      ? colors.surface
                      : colors.surfaceMuted,
                  transform: [{ scale: verified && !reducedMotion ? 1.02 : 1 }],
                  transitionProperty: ['backgroundColor', 'borderColor', 'transform'],
                  transitionDuration: reducedMotion ? 0 : 180,
                  transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 20,
                    color: verified ? colors.success : colors.textPrimary,
                  }}
                >
                  {value[index] ?? ''}
                </Text>
              </Animated.View>
            );
          })}
        </View>
        <View style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <AppInput
            ref={ref}
            unstyled
            hideLabel
            label="Código de verificación de 8 dígitos"
            accessibilityHint={
              error ??
              (verified ? 'Código verificado' : 'Escribe o pega el código completo de 8 dígitos')
            }
            aria-invalid={Boolean(error)}
            // Keep the native field visible to Android's paste menu; the opaque cells cover its text.
            style={{
              height,
              width: '100%',
              color: 'transparent',
              backgroundColor: 'transparent',
              borderWidth: 0,
              padding: 0,
            }}
            caretHidden
            selectionColor="transparent"
            underlineColorAndroid="transparent"
            value={value}
            editable={!disabled && !verified}
            keyboardType="number-pad"
            autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
            textContentType="oneTimeCode"
            autoCorrect={false}
            contextMenuHidden={false}
            selectTextOnFocus
            onFocus={() => {
              setFocused(true);
              setCursor(value.length);
            }}
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            onSelectionChange={(event) => setCursor(event.nativeEvent.selection.start)}
            onChangeText={(text) => {
              const digits = text.replace(/\D/g, '');
              // A complete pasted code replaces the previous digits, even at a middle cursor.
              const insertedLength = digits.length - value.length;
              const next =
                digits.length > OTP_LENGTH && insertedLength >= OTP_LENGTH
                  ? digits.slice(cursor, cursor + OTP_LENGTH)
                  : digits.slice(0, OTP_LENGTH);
              setCursor(next.length);
              onChange(next);
            }}
          />
        </View>
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-danger">
          {error}
        </Text>
      ) : null}
      {verified ? (
        <Text
          accessibilityLiveRegion="polite"
          className="font-sans-medium text-sm"
          style={{ color: colors.success }}
        >
          Código verificado
        </Text>
      ) : null}
    </View>
  );
}
