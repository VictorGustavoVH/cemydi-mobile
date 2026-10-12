import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  type TextInputFocusEvent,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { ToastContext } from '@/hooks/useToast';

type AppScreenProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  edges?: Edge[];
  scroll?: boolean;
};

const scrollContentStyle = { flexGrow: 1 } as const;
type InputTarget = TextInputFocusEvent['target'];
type InputVisibility = {
  focus: (target: InputTarget) => void;
  blur: (target: InputTarget) => void;
};
const InputVisibilityContext = createContext<InputVisibility | null>(null);
export const useInputVisibility = () => useContext(InputVisibilityContext);

type ScreenOverlay = {
  viewport: RefObject<View | null>;
  layoutVersion: number;
  setContent: (content: ReactNode) => void;
};
const ScreenOverlayContext = createContext<ScreenOverlay | null>(null);
export const useScreenOverlay = () => useContext(ScreenOverlayContext);

export function AppScreenOverlay({ children }: { children: ReactNode }) {
  const overlay = useScreenOverlay();
  const setContent = overlay?.setContent;
  useLayoutEffect(() => {
    setContent?.(children);
    return () => setContent?.(null);
  }, [children, setContent]);
  return setContent ? null : children;
}

export function AppScreen({
  children,
  className = '',
  contentClassName = '',
  edges = ['bottom', 'left', 'right'],
  scroll = false,
}: AppScreenProps) {
  const toast = useContext(ToastContext);
  const scrollRef = useRef<ScrollView>(null);
  const overlayViewport = useRef<View>(null);
  const [overlayContent, setOverlayContent] = useState<ReactNode>(null);
  const [overlayLayoutVersion, setOverlayLayoutVersion] = useState(0);
  const overlay = useMemo<ScreenOverlay>(
    () => ({
      viewport: overlayViewport,
      layoutVersion: overlayLayoutVersion,
      setContent: setOverlayContent,
    }),
    [overlayLayoutVersion],
  );

  useEffect(() => {
    return () => {
      toast?.setScrolled(false);
    };
  }, [toast]);
  const focusedInput = useRef<InputTarget | null>(null);
  const scrollOffset = useRef(0);
  const revealFrame = useRef<number | null>(null);
  const [keyboardSpace, setKeyboardSpace] = useState(0);
  const updateKeyboardSpace = useCallback(() => {
    const keyboard = Keyboard.metrics();
    if (!keyboard) {
      setKeyboardSpace(0);
      return;
    }
    scrollRef.current?.getNativeScrollRef()?.measureInWindow((_x, y, _width, height) => {
      const currentKeyboard = Keyboard.metrics();
      if (!currentKeyboard) return;
      const windowTop = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
      // Android may already resize the viewport. Reserve only the remaining overlap.
      setKeyboardSpace(Math.max(0, y + windowTop + height - currentKeyboard.screenY));
    });
  }, []);
  const revealInput = useCallback(() => {
    const target = focusedInput.current;
    const keyboard = Keyboard.metrics();
    if (!target || !keyboard) return;
    target.measureInWindow((_x, y, _width, inputHeight) => {
      if (target !== focusedInput.current) return;
      // Android measures the input from below its status bar; keyboard metrics use screen coordinates.
      const windowTop = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
      const overlap = y + windowTop + inputHeight + 24 - keyboard.screenY;
      if (overlap > 0)
        scrollRef.current?.scrollTo({ y: scrollOffset.current + overlap, animated: true });
    });
  }, []);
  const scheduleReveal = useCallback(() => {
    if (!focusedInput.current) return;
    if (revealFrame.current !== null) cancelAnimationFrame(revealFrame.current);
    // ScrollView must receive the final keyboard frame before measuring the input.
    revealFrame.current = requestAnimationFrame(() => {
      revealFrame.current = requestAnimationFrame(revealInput);
    });
  }, [revealInput]);
  useEffect(
    () => () => {
      focusedInput.current = null;
      if (revealFrame.current !== null) cancelAnimationFrame(revealFrame.current);
    },
    [],
  );
  useEffect(() => {
    if (!scroll) return;
    const show = Keyboard.addListener('keyboardDidShow', () => {
      updateKeyboardSpace();
      scheduleReveal();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardSpace(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [scroll, scheduleReveal, updateKeyboardSpace]);
  useEffect(scheduleReveal, [keyboardSpace, scheduleReveal]);
  const visibility = useMemo<InputVisibility>(
    () => ({
      focus: (target) => {
        focusedInput.current = target;
        scheduleReveal();
      },
      blur: (target) => {
        if (focusedInput.current === target) focusedInput.current = null;
      },
    }),
    [scheduleReveal],
  );
  return (
    <SafeAreaView className={`flex-1 bg-background ${className}`} edges={edges}>
      <ScreenOverlayContext.Provider value={overlay}>
        <View style={{ flex: 1 }}>
          {scroll ? (
            <InputVisibilityContext.Provider value={visibility}>
              <ScrollView
                ref={scrollRef}
                onLayout={() => {
                  updateKeyboardSpace();
                  scheduleReveal();
                }}
                onContentSizeChange={scheduleReveal}
                onScroll={(event) => {
                  const y = event.nativeEvent.contentOffset.y;
                  scrollOffset.current = y;
                  toast?.setScrolled(y > 15);
                }}
                scrollEventThrottle={16}
                style={{ flex: 1 }}
                contentContainerStyle={[scrollContentStyle, { paddingBottom: keyboardSpace }]}
                contentInsetAdjustmentBehavior="automatic"
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
                <View className={`flex-1 ${contentClassName}`}>{children}</View>
              </ScrollView>
            </InputVisibilityContext.Provider>
          ) : (
            <View className={`flex-1 ${contentClassName}`}>{children}</View>
          )}
          <View
            ref={overlayViewport}
            testID="screen-overlay-host"
            collapsable={false}
            pointerEvents="box-none"
            style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: 20 }]}
            onLayout={() => setOverlayLayoutVersion((version) => version + 1)}
          >
            {overlayContent}
          </View>
        </View>
      </ScreenOverlayContext.Provider>
    </SafeAreaView>
  );
}
