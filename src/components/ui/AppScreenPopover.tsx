import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { Keyboard, Platform, StatusBar, View } from 'react-native';
import { AppScreenOverlay, useScreenOverlay } from './AppScreen';

type AppScreenPopoverProps = {
  anchor: RefObject<View | null>;
  children: ReactNode;
};

// The host fills the screen: both drawing and hit testing stay outside the main list.
export function AppScreenPopover({ anchor, children }: AppScreenPopoverProps) {
  const overlay = useScreenOverlay();
  const viewport = overlay?.viewport;
  const layoutVersion = overlay?.layoutVersion;
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0, maxHeight: 0 });
  useLayoutEffect(() => {
    let active = true;
    const measure = () => {
      const anchorView = anchor.current;
      const viewportView = viewport?.current;
      if (!anchorView || !viewportView) return;
      viewportView.measureInWindow((screenX, screenY, _screenWidth, screenHeight) => {
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
          const next = {
            left: x - screenX,
            top,
            width,
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
    const subscription = Keyboard.addListener('keyboardDidShow', measure);
    return () => {
      active = false;
      subscription.remove();
    };
  }, [anchor, viewport, layoutVersion]);
  if (!overlay) return <>{children}</>;
  const ready = position.width > 0 && position.maxHeight > 0;
  return (
    <AppScreenOverlay>
      <View
        pointerEvents={ready ? 'auto' : 'none'}
        style={{ position: 'absolute', ...position, opacity: ready ? 1 : 0 }}
      >
        {children}
      </View>
    </AppScreenOverlay>
  );
}
