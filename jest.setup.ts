import { cleanup } from '@testing-library/react-native';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Every network test must explicitly provide its own response.
beforeEach(() => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('Fetch sin mock explícito en un test.'));
});

afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});

// Mock manual de Reanimated: el mock oficial requiere módulos nativos
// (react-native-worklets) que no existen en Jest.
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('expo-secure-store', () => {
  const values = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      values.delete(key);
    }),
  };
});
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (callback: (...args: unknown[]) => void, ...args: unknown[]) => callback(...args),
}));

jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return { BlurView: View, BlurTargetView: View };
});

jest.mock('react-native-reanimated', () => {
  const { ScrollView, Text, View } = require('react-native');

  const sharedValue = (initial: unknown) => ({
    value: initial,
    set: jest.fn(),
    get: () => initial,
  });

  return {
    __esModule: true,
    default: {
      View,
      ScrollView,
      Text,
      createAnimatedComponent: (component: unknown) => component,
    },
    useReducedMotion: () => false,
    cubicBezier: jest.requireActual('react-native-reanimated/src/css/easing').cubicBezier,
    useSharedValue: sharedValue,
    useAnimatedStyle: (updater: () => object) => updater(),
    useAnimatedProps: (updater: () => object) => updater(),
    cancelAnimation: jest.fn(),
    withRepeat: (value: unknown) => value,
    Easing: { linear: (value: number) => value, bezier: () => (value: number) => value },
    ReduceMotion: { Never: 'never' },
    LinearTransition: { duration: () => undefined },
    FadeIn: { duration: () => undefined },
    FadeOut: { duration: () => undefined },
    withTiming: (value: unknown) => value,
    withSpring: (value: unknown) => value,
  };
});
