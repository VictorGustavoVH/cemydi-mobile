import { useEffect, useMemo, type RefObject } from 'react';
import { AccessibilityInfo, PanResponder, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeOut,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import X from 'lucide-react-native/icons/x';
import { AppButton } from '@/components/ui/AppButton';
import { colors } from '@/theme/colors';
import { ToastIcon } from './ToastIcon';
import { UndoCountdown } from './UndoCountdown';
import type { ToastEntry } from './toast-store';

type AnimatedToastProps = {
  entry: ToastEntry;
  scrolled?: boolean;
  bottom?: boolean;
  blurTarget?: RefObject<View | null>;
  onUndo: (id: number) => Promise<void>;
  onDismiss: (id: number) => void;
  onExited: (id: number, revision: number) => void;
};

export function AnimatedToast({
  entry,
  scrolled = false,
  bottom = false,
  blurTarget,
  onUndo,
  onDismiss,
  onExited,
}: AnimatedToastProps) {
  const { id, revision } = entry;
  const progress = useSharedValue(0);
  const visibility = useSharedValue(0);
  const translateX = useSharedValue(0);
  const isDismissing = useSharedValue(false);
  const reduced = useReducedMotion();
  const scrollOffset = useSharedValue(!reduced && scrolled ? -26 : 0);

  useEffect(() => {
    translateX.set(0);
    isDismissing.set(false);
  }, [id, revision, translateX, isDismissing]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gestureState) => {
          if (entry.closing || isDismissing.get()) return false;
          return (
            Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
          );
        },
        onPanResponderGrant: () => {
          cancelAnimation(translateX);
        },
        onPanResponderMove: (_evt, gestureState) => {
          if (isDismissing.get()) return;
          translateX.set(gestureState.dx);
        },
        onPanResponderRelease: (_evt, gestureState) => {
          if (isDismissing.get()) return;
          const dx = gestureState.dx;
          const vx = gestureState.vx;
          const dismissThreshold = 80;
          const velocityThreshold = 0.5;
          const shouldDismiss = Math.abs(dx) > dismissThreshold || Math.abs(vx) > velocityThreshold;

          if (shouldDismiss) {
            isDismissing.set(true);
            const direction = dx > 0 || (dx === 0 && vx > 0) ? 1 : -1;
            const targetX = direction * 400;

            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

            translateX.set(
              withTiming(targetX, {
                duration: reduced ? 100 : 180,
                easing: Easing.bezier(0.23, 1, 0.32, 1),
              }),
            );
            visibility.set(withTiming(0, { duration: reduced ? 100 : 150 }));
            onDismiss(id);
          } else {
            translateX.set(
              withSpring(0, {
                dampingRatio: 0.8,
                duration: 300,
                reduceMotion: ReduceMotion.System,
              }),
            );
          }
        },
        onPanResponderTerminate: () => {
          if (!isDismissing.get()) {
            translateX.set(
              withSpring(0, {
                dampingRatio: 0.8,
                duration: 300,
                reduceMotion: ReduceMotion.System,
              }),
            );
          }
        },
      }),
    [entry.closing, id, isDismissing, onDismiss, reduced, translateX, visibility],
  );

  useEffect(() => {
    scrollOffset.set(
      withTiming(!reduced && scrolled ? -26 : 0, {
        duration: reduced ? 100 : 180,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
      }),
    );
    return () => cancelAnimation(scrollOffset);
  }, [scrolled, reduced, scrollOffset]);

  useEffect(() => {
    if (!entry.closing) {
      AccessibilityInfo.announceForAccessibility(entry.message);
      visibility.set(withTiming(1, { duration: reduced ? 100 : 160 }));
      progress.set(
        withTiming(1, {
          duration: reduced ? 0 : 280,
          easing: Easing.bezier(0.23, 1, 0.32, 1),
        }),
      );
    } else {
      visibility.set(withTiming(0, { duration: reduced ? 100 : 150 }));
      progress.set(
        withTiming(
          0,
          { duration: reduced ? 100 : 180, easing: Easing.bezier(0.23, 1, 0.32, 1) },
          (finished) => {
            if (finished) scheduleOnRN(onExited, id, revision);
          },
        ),
      );
    }
    return () => {
      cancelAnimation(progress);
      cancelAnimation(visibility);
    };
  }, [entry.closing, id, revision, entry.message, progress, visibility, reduced, onExited]);

  const iconEntering = () => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ scale: reduced ? 1 : 0.97 }] },
      animations: {
        opacity: withTiming(1, { duration: reduced ? 100 : 180 }),
        transform: [{ scale: withTiming(1, { duration: reduced ? 0 : 180 }) }],
      },
    };
  };

  const style = useAnimatedStyle(() => {
    const entranceY = reduced ? 0 : (bottom ? 12 : -12) * (1 - progress.get());
    const currentTranslateX = translateX.get();
    const dragFade = interpolate(
      Math.abs(currentTranslateX),
      [0, 150],
      [1, 0.4],
      Extrapolation.CLAMP,
    );
    return {
      opacity: visibility.get() * (reduced ? 1 : dragFade),
      transform: [
        { translateX: currentTranslateX },
        { translateY: reduced ? 0 : entranceY + scrollOffset.get() },
        { scale: reduced ? 1 : 0.98 + 0.02 * progress.get() },
      ],
    };
  });
  const undo = entry.type === 'undo';
  return (
    <Animated.View
      {...panResponder.panHandlers}
      testID="animated-toast"
      pointerEvents={entry.closing ? 'none' : 'auto'}
      style={[styles.shadow, { borderRadius: undo ? 14 : 16 }, style]}
    >
      <View style={[styles.surface, { borderRadius: undo ? 14 : 16 }]}>
        <BlurView
          pointerEvents="none"
          blurTarget={blurTarget}
          blurMethod="dimezisBlurView"
          intensity={36}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.toastSurface }]}
        />
        <View
          className="flex-row items-center"
          style={{
            minHeight: undo ? 42 : 42,
            paddingVertical: undo ? 6 : 6,
            paddingHorizontal: undo ? 10 : 12,
            gap: undo ? 9 : 10,
          }}
        >
          <Animated.View
            key={`icon-${entry.revision}`}
            entering={iconEntering}
            exiting={FadeOut.duration(100)}
          >
            {undo && entry.deadline !== null ? (
              <UndoCountdown
                deadline={entry.deadline}
                duration={Math.max(1000, entry.duration ?? 6000)}
              />
            ) : (
              <ToastIcon type={entry.type === 'undo' ? 'success' : entry.type} />
            )}
          </Animated.View>
          <Animated.View
            className="flex-1"
            key={`message-${entry.revision}`}
            entering={FadeIn.duration(reduced ? 100 : 180)}
          >
            <Text
              accessibilityLiveRegion="polite"
              style={{
                color: colors.toastText,
                fontFamily: 'Inter_700Bold',
                fontSize: undo ? 12.3 : 13,
                letterSpacing: undo ? -0.2 : -0.1,
                lineHeight: 17,
              }}
            >
              {entry.message}
            </Text>
          </Animated.View>
          {undo ? (
            <AppButton
              label="Deshacer"
              accessibilityLabel="Deshacer eliminación del producto"
              accessibilityHint={`Disponible durante ${Math.ceil(Math.max(1000, entry.duration ?? 6000) / 1000)} segundos`}
              variant="unstyled"
              className="min-h-8 justify-center px-0"
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              onPress={() => {
                void onUndo(entry.id);
              }}
            >
              <Text
                style={{ color: colors.brandStrong, fontFamily: 'Inter_700Bold', fontSize: 12 }}
              >
                Deshacer
              </Text>
            </AppButton>
          ) : (
            <AppButton
              label="Cerrar notificación"
              accessibilityLabel="Cerrar notificación"
              variant="unstyled"
              className="h-7 w-7 items-center justify-center rounded-full"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => {
                onDismiss(entry.id);
              }}
            >
              <X aria-hidden color={colors.textSecondary} size={16} strokeWidth={2.2} />
            </AppButton>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: colors.toastText,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 13,
    elevation: 4,
  },
  surface: { overflow: 'hidden', borderWidth: 1, borderColor: colors.toastBorder },
});
