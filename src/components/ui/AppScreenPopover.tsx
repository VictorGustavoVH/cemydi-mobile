import { useEffect, useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { BackHandler, Keyboard, Platform, StatusBar, StyleSheet, View } from 'react-native';
import { AppScreenOverlay, useScreenOverlay } from './AppScreen';
import { AppButton } from './AppButton';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

type AppScreenPopoverProps = {
  anchor: RefObject<View | null>;
  children: ReactNode;
  preferredWidth?: number;
  align?: 'start' | 'end';
  onDismiss?: () => void;
  animate?: boolean;
};

// The host fills the screen: both drawing and hit testing stay outside the main list.
export function AppScreenPopover({
  anchor,
  children,
  preferredWidth,
  align = 'start',
  onDismiss,
  animate = false,
}: AppScreenPopoverProps) {
  const reducedMotion = useReducedMotion();
  const overlay = useScreenOverlay();
  const viewport = overlay?.viewport;
  const layoutVersion = overlay?.layoutVersion;
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0, maxHeight: 0 });
  useEffect(() => {
    if (!onDismiss) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss();
      return true;
    });
    return () => subscription.remove();
  }, [onDismiss]);
  useLayoutEffect(() => {
    let active = true;
    const measure = () => {
      const anchorView = anchor.current;
      const viewportView = viewport?.current;
      if (!anchorView || !viewportView) return;
      viewportView.measureInWindow((screenX, screenY, screenWidth, screenHeight) => {
        if (!active) return;
        anchorView.measureInWindow((x, y, width, height) => {
          if (!active) return;
          const keyboard = Keyboard.metrics();
          const statusBar = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
          const bottom = Math.min(
            screenY + screenHeight,
            keyboard ? keyboard.screenY - statusBar : Infinity,
          );
          const top = y + height - screenY + 4;
          const popoverWidth = preferredWidth
            ? Math.min(preferredWidth, Math.max(0, screenWidth - 16))
            : width;
          const left = x - screenX + (align === 'end' ? width - popoverWidth : 0);
          const next = {
            left: preferredWidth
              ? Math.max(8, Math.min(left, screenWidth - popoverWidth - 8))
              : left,
            top,
            width: popoverWidth,
            maxHeight: Math.max(0, bottom - screenY - top - 8),
          };
          setPosition((current) =>
            current.left === next.left &&
            current.top === next.top &&
            current.width === next.width &&
            current.maxHeight === next.maxHeight
              ? current
              : next,
          );
        });
      });
    };
    measure();
    const subscriptions = [
      Keyboard.addListener('keyboardDidShow', measure),
      Keyboard.addListener('keyboardDidHide', measure),
    ];
    return () => {
      active = false;
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [anchor, viewport, layoutVersion, preferredWidth, align]);
  if (!overlay) return <>{children}</>;
  const ready = position.width > 0 && position.maxHeight > 0;
  return (
    <AppScreenOverlay>
      <View
        accessibilityViewIsModal={Boolean(onDismiss)}
        pointerEvents="box-none"
        style={StyleSheet.absoluteFill}
      >
        {onDismiss ? (
          <AppButton
            label="Cerrar desplegable"
            hideLabel
            variant="unstyled"
            style={StyleSheet.absoluteFill}
            onPress={onDismiss}
          />
        ) : null}
        <Animated.View
          pointerEvents={ready ? 'auto' : 'none'}
          style={{
            position: 'absolute',
            ...position,
            opacity: ready ? 1 : 0,
            ...(animate && ready
              ? {
                  transformOrigin: 'top right',
                  animationName: {
                    from: {
                      opacity: 0,
                      transform: reducedMotion ? [] : [{ translateY: -4 }, { scale: 0.98 }],
                    },
                    to: {
                      opacity: 1,
                      transform: reducedMotion ? [] : [{ translateY: 0 }, { scale: 1 }],
                    },
                  },
                  animationDuration: reducedMotion ? 80 : 180,
                  animationTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
                  animationFillMode: 'both',
                }
              : {}),
          }}
        >
          {children}
        </Animated.View>
      </View>
    </AppScreenOverlay>
  );
}
