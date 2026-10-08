import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const circumference = 2 * Math.PI * 12;

export function UndoCountdown({ deadline, duration }: { deadline: number; duration: number }) {
  const remaining = useSharedValue(1);
  const [seconds, setSeconds] = useState(() =>
    Math.ceil(Math.max(0, deadline - Date.now()) / 1000),
  );
  useEffect(() => {
    const left = Math.max(0, deadline - Date.now());
    remaining.set(left / duration);
    // Functional time information remains linear even with reduced motion.
    remaining.set(
      withTiming(0, { duration: left, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
    );
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const ms = Math.max(0, deadline - Date.now());
      setSeconds(Math.ceil(ms / 1000));
      if (ms > 0) timer = setTimeout(tick, ms % 1000 || 1000);
    };
    tick();
    return () => {
      clearTimeout(timer);
      cancelAnimation(remaining);
    };
  }, [deadline, duration, remaining]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - remaining.get()),
  }));
  return (
    <View
      aria-hidden
      style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg
        width={30}
        height={30}
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
      >
        <Circle
          cx={15}
          cy={15}
          r={12}
          stroke={colors.toastCountdownTrack}
          strokeWidth={2.5}
          fill="none"
        />
        <AnimatedCircle
          cx={15}
          cy={15}
          r={12}
          stroke={colors.brand}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
        />
      </Svg>
      <Text
        style={{
          color: colors.brand,
          fontFamily: 'Inter_700Bold',
          fontSize: 12,
          fontVariant: ['tabular-nums'],
        }}
      >
        {seconds}
      </Text>
    </View>
  );
}
