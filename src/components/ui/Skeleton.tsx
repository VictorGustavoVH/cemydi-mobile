import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type SkeletonProps = { children: ReactNode; label?: string };
type SkeletonBlockProps = { className: string };

/** One animation and one accessible announcement for a whole loading structure. */
export function Skeleton({ children, label = 'Cargando contenido…' }: SkeletonProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(reducedMotion ? 1 : withRepeat(withTiming(0.55, { duration: 900 }), -1, true));
    return () => cancelAnimation(opacity);
  }, [opacity, reducedMotion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      <Animated.View
        style={style}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {children}
      </Animated.View>
    </View>
  );
}

export function SkeletonBlock({ className }: SkeletonBlockProps) {
  return <View className={`rounded-lg bg-border/40 ${className}`} />;
}
