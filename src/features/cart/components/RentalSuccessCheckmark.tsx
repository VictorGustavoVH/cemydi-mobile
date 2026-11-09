import { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import Check from 'lucide-react-native/icons/check';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const BADGE_SIZE = 88;
const STROKE_WIDTH = 3;
const RADIUS = (BADGE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CORE_SIZE = 64;
const CHECK_SIZE = 34;

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

type RentalSuccessCheckmarkProps = {
  testID?: string;
};

/**
 * Confirmación visual tipo Apple Pay ejecutada en el hilo de UI:
 * el anillo traza el perímetro, el núcleo asienta con resorte amortiguado
 * y la palomita se dibuja progresivamente de izquierda a derecha.
 */
export function RentalSuccessCheckmark({
  testID = 'rental-success-checkmark',
}: RentalSuccessCheckmarkProps) {
  const reducedMotion = useReducedMotion();

  const badgeOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const badgeScale = useSharedValue(reducedMotion ? 1 : 0.92);
  const ringProgress = useSharedValue(reducedMotion ? 1 : 0);
  const coreScale = useSharedValue(reducedMotion ? 1 : 0.92);
  const checkReveal = useSharedValue(reducedMotion ? 1 : 0);
  const checkScale = useSharedValue(reducedMotion ? 1 : 0.92);
  const haloScale = useSharedValue(reducedMotion ? 1 : 0.94);
  const haloOpacity = useSharedValue(reducedMotion ? 0 : 0.42);

  useEffect(() => {
    void Haptics.notificationAsync?.(Haptics.NotificationFeedbackType?.Success)?.catch(
      () => undefined,
    );

    if (reducedMotion) {
      badgeOpacity.set(1);
      badgeScale.set(1);
      ringProgress.set(1);
      coreScale.set(1);
      checkReveal.set(1);
      checkScale.set(1);
      haloScale.set(1);
      haloOpacity.set(0);
      return;
    }

    badgeOpacity.set(withTiming(1, { duration: 160, easing: EASE_OUT }));
    badgeScale.set(withSpring(1, { duration: 420, dampingRatio: 0.8 }));
    ringProgress.set(withTiming(1, { duration: 360, easing: EASE_OUT }));
    coreScale.set(withDelay(80, withSpring(1, { duration: 380, dampingRatio: 0.78 })));
    checkReveal.set(withDelay(150, withTiming(1, { duration: 240, easing: EASE_OUT })));
    checkScale.set(withDelay(150, withSpring(1, { duration: 360, dampingRatio: 0.76 })));
    haloOpacity.set(
      withDelay(
        120,
        withTiming(0, {
          duration: 460,
          easing: EASE_OUT,
        }),
      ),
    );
    haloScale.set(withDelay(120, withTiming(1.24, { duration: 460, easing: EASE_OUT })));

    return () => {
      cancelAnimation(badgeOpacity);
      cancelAnimation(badgeScale);
      cancelAnimation(ringProgress);
      cancelAnimation(coreScale);
      cancelAnimation(checkReveal);
      cancelAnimation(checkScale);
      cancelAnimation(haloOpacity);
      cancelAnimation(haloScale);
    };
  }, [
    reducedMotion,
    badgeOpacity,
    badgeScale,
    ringProgress,
    coreScale,
    checkReveal,
    checkScale,
    haloOpacity,
    haloScale,
  ]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity.get(),
    transform: [{ scale: haloScale.get() }],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.get(),
    transform: [{ scale: badgeScale.get() }],
  }));

  const ringAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - ringProgress.get()),
  }));

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: coreScale.get() }],
  }));

  const checkClipStyle = useAnimatedStyle(() => ({
    width: CHECK_SIZE * checkReveal.get(),
  }));

  const checkIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.get() }],
  }));

  return (
    <View
      testID={testID}
      style={{
        width: BADGE_SIZE,
        height: BADGE_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: BADGE_SIZE,
            height: BADGE_SIZE,
            borderRadius: BADGE_SIZE / 2,
            borderWidth: 2,
            borderColor: colors.brand,
            backgroundColor: colors.brandMuted,
          },
          haloStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            width: BADGE_SIZE,
            height: BADGE_SIZE,
            borderRadius: BADGE_SIZE / 2,
            backgroundColor: colors.brandMuted,
            alignItems: 'center',
            justifyContent: 'center',
          },
          badgeStyle,
        ]}
      >
        <Svg
          aria-hidden
          width={BADGE_SIZE}
          height={BADGE_SIZE}
          style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
        >
          <Circle
            cx={BADGE_SIZE / 2}
            cy={BADGE_SIZE / 2}
            r={RADIUS}
            stroke={colors.brand}
            strokeOpacity={0.18}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          <AnimatedCircle
            cx={BADGE_SIZE / 2}
            cy={BADGE_SIZE / 2}
            r={RADIUS}
            stroke={colors.brandStrong}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            animatedProps={ringAnimatedProps}
          />
        </Svg>
        <Animated.View
          style={[
            {
              width: CORE_SIZE,
              height: CORE_SIZE,
              borderRadius: CORE_SIZE / 2,
              backgroundColor: colors.brandStrong,
              alignItems: 'center',
              justifyContent: 'center',
            },
            coreStyle,
          ]}
        >
          <View style={{ width: CHECK_SIZE, height: CHECK_SIZE }}>
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  overflow: 'hidden',
                },
                checkClipStyle,
              ]}
            >
              <Animated.View style={[{ width: CHECK_SIZE, height: CHECK_SIZE }, checkIconStyle]}>
                <Check aria-hidden size={CHECK_SIZE} color={colors.onBrand} strokeWidth={3} />
              </Animated.View>
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
