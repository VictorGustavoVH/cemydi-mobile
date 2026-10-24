import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo, AppState } from 'react-native';
import { useBannerPlayback } from '../useBannerPlayback';

jest.mock('expo-router', () => ({
  useFocusEffect: jest.requireActual('react').useEffect,
}));

it('reanuda el autoplay después de una pausa temporal y limpia sus temporizadores', async () => {
  const initialState = AppState.currentState;
  AppState.currentState = 'active';
  jest.useFakeTimers();
  try {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    const advance = jest.fn();
    const { result, unmount } = await renderHook(() => useBannerPlayback(advance, true));
    await act(() => result.current.setPaused(true));
    await act(() => jest.advanceTimersByTime(6000));
    expect(result.current.paused).toBe(false);
    expect(advance).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(6000));
    expect(advance).toHaveBeenCalledTimes(1);
    await unmount();
    await act(() => jest.advanceTimersByTime(12000));
    expect(advance).toHaveBeenCalledTimes(1);
  } finally {
    AppState.currentState = initialState;
    jest.useRealTimers();
  }
});
