import { useRef, useState, type ComponentProps } from 'react';
import {
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import CircleQuestionMark from 'lucide-react-native/icons/circle-question-mark';
import LockKeyhole from 'lucide-react-native/icons/lock-keyhole';
import X from 'lucide-react-native/icons/x';
import { AppInput } from './AppInput';
import { AppButton } from './AppButton';
import { colors } from '@/theme';

type PasswordFieldProps = Omit<
  ComponentProps<typeof AppInput>,
  'secureTextEntry' | 'trailingAction' | 'labelAction'
>;
export function PasswordField({ editable = true, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const helpAnchor = useRef<View>(null);
  const [anchor, setAnchor] = useState({ x: 16, y: 100, height: 28 });
  const [tooltipHeight, setTooltipHeight] = useState(160);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tooltipWidth = Math.min(320, width - 32);
  const tooltipLeft = Math.max(16, Math.min(anchor.x - 12, width - tooltipWidth - 16));
  const below = anchor.y + anchor.height + 8;
  const availableBottom = Math.min(
    height - insets.bottom - 16,
    Keyboard.metrics()?.screenY ?? height,
  );
  const tooltipTop = Math.max(
    insets.top + 8,
    below + tooltipHeight <= availableBottom ? below : anchor.y - tooltipHeight - 8,
  );
  const Icon = visible ? EyeOff : Eye;
  const iconColor = props.error
    ? colors.inputError
    : props.valid
      ? colors.brand
      : colors.textSecondary;
  return (
    <View className="gap-2">
      <AppInput
        {...props}
        editable={editable}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={!visible}
        labelAction={
          <View ref={helpAnchor} collapsable={false}>
            <AppButton
              hideLabel
              label={`Requisitos de ${props.label.toLowerCase()}`}
              accessibilityState={{ expanded: showHelp }}
              variant="ghost"
              className="h-7 w-7 px-0 py-0"
              hitSlop={8}
              disabled={!editable}
              onPress={() => {
                helpAnchor.current?.measureInWindow((x, y, _width, anchorHeight) =>
                  setAnchor({ x, y, height: anchorHeight }),
                );
                setShowHelp(true);
              }}
              leftIcon={<CircleQuestionMark aria-hidden color={colors.textSecondary} size={18} />}
            />
          </View>
        }
        leadingIcon={<LockKeyhole aria-hidden color={iconColor} size={20} />}
        trailingAction={
          <AppButton
            hideLabel
            label={`${visible ? 'Ocultar' : 'Mostrar'} ${props.label.toLowerCase()}`}
            accessibilityState={{ expanded: visible }}
            variant="ghost"
            className="h-11 w-11 px-0 py-0"
            disabled={!editable}
            onPress={() => setVisible((current) => !current)}
            leftIcon={<Icon aria-hidden color={iconColor} size={20} />}
          />
        }
      />
      {showHelp ? (
        <Modal
          transparent
          visible
          animationType="none"
          statusBarTranslucent
          onRequestClose={() => setShowHelp(false)}
        >
          <View style={{ flex: 1 }}>
            <AppButton
              label="Cerrar ayuda de contraseña"
              hideLabel
              variant="unstyled"
              style={StyleSheet.absoluteFill}
              onPress={() => setShowHelp(false)}
            />
            <View
              accessibilityViewIsModal
              onLayout={(event) => setTooltipHeight(event.nativeEvent.layout.height)}
              style={{
                position: 'absolute',
                left: tooltipLeft,
                top: tooltipTop,
                width: tooltipWidth,
                maxHeight: Math.max(100, availableBottom - insets.top - 24),
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
                padding: 12,
                elevation: 8,
                boxShadow: '0 4px 18px rgba(15,23,42,0.16)',
              }}
            >
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 font-sans-semibold text-sm text-primary">
                  Requisitos de contraseña
                </Text>
                <AppButton
                  label="Cerrar requisitos"
                  hideLabel
                  variant="ghost"
                  className="h-11 w-11 px-0 py-0"
                  onPress={() => setShowHelp(false)}
                  leftIcon={<X aria-hidden color={colors.textSecondary} size={18} />}
                />
              </View>
              <ScrollView bounces={false}>
                <Text
                  accessibilityLiveRegion="polite"
                  className="font-sans text-sm leading-6 text-secondary"
                >
                  Usa entre 10 y 72 caracteres e incluye al menos una letra mayúscula, un número y
                  un símbolo.
                </Text>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
