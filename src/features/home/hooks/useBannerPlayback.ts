import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

export function useBannerPlayback(onAdvance: () => void, enabled: boolean) {
  const [paused, setPaused] = useState(false);
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [reduceMotion, setReduceMotion] = useState(true);
  const [screenReader, setScreenReader] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduceMotion(value);
      })
      .catch(() => {});
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((value) => {
        if (mounted) setScreenReader(value);
      })
      .catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const reader = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    const appState = AppState.addEventListener('change', (state) =>
      setForeground(state === 'active'),
    );
    return () => {
      mounted = false;
      motion.remove();
      reader.remove();
      appState.remove();
    };
  }, []);

  const canAutoPlay = !reduceMotion && !screenReader;
  useEffect(() => {
    if (!enabled || !focused || !foreground || !canAutoPlay || paused) return;
    const timer = setInterval(onAdvance, 6000);
    return () => clearInterval(timer);
  }, [canAutoPlay, enabled, focused, foreground, onAdvance, paused]);

  return { canAutoPlay, paused, reduceMotion, setPaused };
}
