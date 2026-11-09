import PackageX from 'lucide-react-native/icons/package-x';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { colors } from '@/theme';

type EmptyProductIconProps = {
  /** Icono Lucide alternativo; por defecto, caja tachada. */
  icon?: typeof PackageX;
  testID?: string;
  size?: 'normal' | 'compact';
};

const SIZES = {
  normal: { icon: 56, mb: 4 },
  compact: { icon: 36, mb: 2 },
};

/**
 * Icono limpio y directo para estados sin productos (sin tarjetas ni círculos envolventes).
 * Entrada fluida en opacidad y escala sutil.
 */
export function EmptyProductIcon({
  icon: Icon = PackageX,
  testID = 'empty-product-icon',
  size = 'normal',
}: EmptyProductIconProps) {
  const reducedMotion = useReducedMotion();
  const { icon: iconSize, mb } = SIZES[size];
  return (
    <Animated.View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: mb,
        animationName: {
          from: { opacity: 0, transform: reducedMotion ? [] : [{ scale: 0.94 }] },
          to: { opacity: 1, transform: reducedMotion ? [] : [{ scale: 1 }] },
        },
        animationDuration: reducedMotion ? 120 : 200,
        animationTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
        animationFillMode: 'both',
      }}
    >
      <Icon aria-hidden size={iconSize} color={colors.disabled} strokeWidth={1.5} />
    </Animated.View>
  );
}
