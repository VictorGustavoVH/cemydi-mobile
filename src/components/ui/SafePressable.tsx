import { forwardRef, useRef } from 'react';
import { Pressable, type PressableProps, type View } from 'react-native';
import {
  DEFAULT_NAVIGATION_INTERVAL_MS,
  useNavigationGuard,
} from '@/providers/navigation-guard-provider';

export type SafePressableProps = PressableProps & {
  className?: string;
  /** Forwarded by Expo Router's Link when using asChild. */
  href?: string;
  /** Set to zero for controls that must respond to every press. */
  pressIntervalMs?: number;
};

/** Local press guard; it does not acquire the router lock a second time. */
export const SafePressable = forwardRef<View, SafePressableProps>(function SafePressable(
  { onPress, disabled, pressIntervalMs, ...props },
  ref,
) {
  const lastPress = useRef<number | null>(null);
  const intervalMs = pressIntervalMs ?? DEFAULT_NAVIGATION_INTERVAL_MS;
  const navigate = useNavigationGuard(pressIntervalMs);
  return (
    <Pressable
      {...props}
      ref={ref}
      disabled={disabled}
      onPress={(event) => {
        if (disabled || !onPress) return;
        const now = Date.now();
        if (lastPress.current !== null && now - lastPress.current < intervalMs) {
          event?.preventDefault();
          return;
        }
        lastPress.current = now;
        try {
          if (props.href) navigate(() => onPress(event));
          else onPress(event);
        } catch (error) {
          lastPress.current = null;
          throw error;
        }
      }}
    />
  );
});
