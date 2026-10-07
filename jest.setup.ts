(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Every network test must explicitly provide its own response.
beforeEach(() => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('Fetch sin mock explícito en un test.'));
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Mock manual de Reanimated: el mock oficial requiere módulos nativos
// (react-native-worklets) que no existen en Jest.
/* eslint-disable @typescript-eslint/no-require-imports */
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
    useSharedValue: sharedValue,
    useAnimatedStyle: (updater: () => object) => updater(),
    withTiming: (value: unknown) => value,
    withSpring: (value: unknown) => value,
  };
});
