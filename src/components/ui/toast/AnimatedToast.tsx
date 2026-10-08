import { useEffect, type RefObject } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
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
  blurTarget?: RefObject<View | null>;
  onUndo: (id: number) => Promise<void>;
  onDismiss: (id: number) => void;
  onExited: (id: number, revision: number) => void;
};

export function AnimatedToast({
  entry,
  scrolled = false,
  blurTarget,
  onUndo,
  onDismiss,
  onExited,
}: AnimatedToastProps) {
  const { id, revision } = entry;
  const progress = useSharedValue(0);
  const scrollOffset = useSharedValue(scrolled ? -26 : 0);
  const reduced = useReducedMotion();

  useEffect(() => {
    scrollOffset.set(
      withTiming(scrolled ? -26 : 0, {
        duration: reduced ? 100 : 260,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      }),
    );
  }, [scrolled, reduced, scrollOffset]);

  useEffect(() => {
    if (!entry.closing) {
      AccessibilityInfo.announceForAccessibility(entry.message);
      progress.set(
        withTiming(1, {
          duration: reduced ? 100 : 380,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
      );
    } else {
      progress.set(
        withTiming(
          0,
          { duration: reduced ? 100 : 220, easing: Easing.bezier(0.25, 1, 0.5, 1) },
          (finished) => {
            if (finished) scheduleOnRN(onExited, id, revision);
          },
        ),
      );
    }
  }, [entry.closing, id, revision, entry.message, progress, reduced, onExited]);

  const iconEntering = () => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ scale: reduced ? 1 : 0.94 }] },
      animations: {
        opacity: withTiming(1, { duration: reduced ? 100 : 200 }),
        transform: [{ scale: withTiming(1, { duration: reduced ? 0 : 200 }) }],
      },
    };
  };

  const style = useAnimatedStyle(() => {
    const entranceY = reduced ? 0 : -32 * (1 - progress.get());
    return {
      opacity: progress.get(),
      transform: [
        { translateY: entranceY + scrollOffset.get() },
        { scale: reduced ? 1 : 0.94 + 0.06 * progress.get() },
      ],
    };
  });
  const undo = entry.type === 'undo';
  return (
    <Animated.View
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
