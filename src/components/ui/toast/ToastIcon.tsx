import { useEffect } from 'react';
import LoaderCircle from 'lucide-react-native/icons/loader-circle';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import CircleX from 'lucide-react-native/icons/circle-x';
import Info from 'lucide-react-native/icons/info';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import type { ToastConfig } from './toast-store';

export function ToastIcon({ type }: { type: Exclude<ToastConfig['type'], 'undo'> }) {
  const rotation = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (type === 'loading' && !reduced)
      rotation.set(withRepeat(withTiming(360, { duration: 800, easing: Easing.linear }), -1));
    return () => {
      cancelAnimation(rotation);
      rotation.set(0);
    };
  }, [type, reduced, rotation]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));
  const Icon = { loading: LoaderCircle, success: CircleCheck, error: CircleX, info: Info }[type];
  const color = {
    loading: colors.brand,
    success: colors.toastSuccess,
    error: colors.toastError,
    info: colors.toastInfo,
  }[type];
  return (
    <Animated.View
      aria-hidden
      style={[
        {
          width: 24,
          height: 24,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: color,
          shadowOpacity: 0.16,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 0 },
        },
        style,
      ]}
    >
      <Icon color={color} size={22} strokeWidth={2.35} />
    </Animated.View>
  );
}
