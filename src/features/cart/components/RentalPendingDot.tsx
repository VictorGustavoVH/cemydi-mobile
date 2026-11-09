import { useSyncExternalStore } from 'react';
import { AppState, View } from 'react-native';
import Animated, { useReducedMotion, type CSSAnimationKeyframes } from 'react-native-reanimated';
import { colors } from '@/theme';

const breathing: CSSAnimationKeyframes = {
  '0%, 100%': { opacity: 0.18, transform: [{ scale: 0.85 }] },
  '50%': { opacity: 0.4, transform: [{ scale: 1.25 }] },
};
const subscribe = (onChange: () => void) => {
  const subscription = AppState.addEventListener('change', onChange);
  return () => subscription.remove();
};
const snapshot = () => AppState.currentState;

export function RentalPendingDot() {
  const reducedMotion = useReducedMotion();
  const appState = useSyncExternalStore(subscribe, snapshot, snapshot);
  return (
    <View
      testID="cart-item-pending-dot"
      accessible={false}
      pointerEvents="none"
      className="h-4 w-4 items-center justify-center"
    >
      <Animated.View
        style={{
          position: 'absolute',
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: colors.rentalPending,
          opacity: 0.18,
          animationName: reducedMotion ? 'none' : breathing,
          animationDuration: '1800ms',
          animationIterationCount: 'infinite',
          animationTimingFunction: 'ease-in-out',
          animationPlayState:
            appState === 'background' || appState === 'inactive' ? 'paused' : 'running',
        }}
      />
      <View
        style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.rentalPending }}
      />
    </View>
  );
}
