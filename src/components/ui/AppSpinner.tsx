import { useSyncExternalStore } from 'react';
import { AppState, View } from 'react-native';
import Animated, { useReducedMotion, type CSSAnimationKeyframes } from 'react-native-reanimated';
import LoaderCircle from 'lucide-react-native/icons/loader-circle';
import { colors } from '@/theme';

type AppSpinnerProps = {
  size?: number;
  color?: string;
  label?: string;
  animating?: boolean;
  decorative?: boolean;
};

const rotation: CSSAnimationKeyframes = {
  from: { transform: [{ rotate: '0deg' }] },
  to: { transform: [{ rotate: '360deg' }] },
};

function subscribeToAppState(onChange: () => void) {
  const subscription = AppState.addEventListener('change', onChange);
  return () => subscription.remove();
}

const subscribeIdle = () => () => undefined;
const getAppState = () => AppState.currentState;

/** Continuous UI-thread feedback; background and reduced-motion states stay still. */
export function AppSpinner({
  size = 40,
  color = colors.brandStrong,
  label = 'Cargando…',
  animating = true,
  decorative = false,
}: AppSpinnerProps) {
  const reducedMotion = useReducedMotion();
  const appState = useSyncExternalStore(
    animating ? subscribeToAppState : subscribeIdle,
    getAppState,
    getAppState,
  );

  if (!animating) return null;

  const strokeWidth = size < 28 ? 2 : 2.5;
  // LoaderCircle instalado: centro (12, 12), radio 9 en un viewport de 24.
  // La pista nativa incluye el borde en su caja; su línea central debe coincidir.
  const radius = (size * 9) / 24;
  const trackInset = (size - radius * 2 - strokeWidth) / 2;
  const paused = appState === 'background' || appState === 'inactive' || appState === 'extension';

  return (
    <View
      accessible={!decorative}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      style={{ width: size, height: size }}
    >
      <View
        style={{
          position: 'absolute',
          inset: trackInset,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: color,
          opacity: 0.16,
        }}
      />
      <Animated.View
        style={{
          width: size,
          height: size,
          animationName: reducedMotion ? 'none' : rotation,
          animationDuration: '900ms',
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
          animationPlayState: paused ? 'paused' : 'running',
        }}
      >
        <LoaderCircle aria-hidden size={size} color={color} strokeWidth={strokeWidth} />
      </Animated.View>
    </View>
  );
}
