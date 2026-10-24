import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors } from '@/theme';
import { AppButton } from './AppButton';

type AppSwitchProps = {
  label: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
};

export function AppSwitch({ label, value, disabled = false, onValueChange }: AppSwitchProps) {
  const progress = useSharedValue(value ? 1 : 0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    progress.set(
      reducedMotion ? Number(value) : withSpring(Number(value), { stiffness: 450, damping: 43 }),
    );
  }, [value, progress, reducedMotion]);
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: progress.get() * 20 }] }));
  return (
    <AppButton
      label={label}
      variant="unstyled"
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      className="min-h-11 w-[55px] shrink-0 items-center justify-center"
    >
      <Animated.View
        style={{
          width: 51,
          height: 31,
          borderRadius: 16,
          padding: 2,
          backgroundColor: value ? colors.brandStrong : colors.border,
        }}
      >
        <Animated.View
          style={[
            {
              width: 27,
              height: 27,
              borderRadius: 14,
              backgroundColor: colors.background,
              boxShadow: '0px 1px 3px rgba(0,0,0,0.18)',
            },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </AppButton>
  );
}
