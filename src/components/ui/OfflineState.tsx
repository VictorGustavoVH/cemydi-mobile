import { Text, View } from 'react-native';
import WifiOff from 'lucide-react-native/icons/wifi-off';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { colors } from '@/theme';

type OfflineStateProps = {
  title?: string;
  description?: string;
};

export function OfflineState({
  title = 'Sin conexión',
  description = 'Revisa tu conexión a internet e intenta de nuevo.',
}: OfflineStateProps) {
  const reducedMotion = useReducedMotion();

  return (
    <View
      accessibilityLiveRegion="assertive"
      className="flex-1 items-center justify-center gap-3 p-6"
    >
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 4,
          animationName: {
            from: { opacity: 0, transform: reducedMotion ? [] : [{ scale: 0.94 }] },
            to: { opacity: 1, transform: reducedMotion ? [] : [{ scale: 1 }] },
          },
          animationDuration: reducedMotion ? 120 : 200,
          animationTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
          animationFillMode: 'both',
        }}
      >
        <WifiOff aria-hidden size={56} color={colors.disabled} strokeWidth={1.5} />
      </Animated.View>
      <Text
        accessibilityRole="header"
        className="text-center font-sans-semibold text-lg text-primary"
      >
        {title}
      </Text>
      <Text className="text-center font-sans text-sm text-secondary">{description}</Text>
    </View>
  );
}
