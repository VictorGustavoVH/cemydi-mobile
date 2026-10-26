import { act, render, screen } from '@testing-library/react-native';
import { Keyboard, Text } from 'react-native';
import { AppScreen } from '../AppScreen';

let mockViewportHeight = 800;
jest.mock('react-native', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const native = jest.requireActual('react-native');
  const React = require('react');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const ScrollView = React.forwardRef((props: { children?: React.ReactNode }, ref: unknown) => {
    React.useImperativeHandle(ref, () => ({
      getNativeScrollRef: () => ({
        measureInWindow: (measure: (x: number, y: number, width: number, height: number) => void) =>
          measure(0, 0, 390, mockViewportHeight),
      }),
      scrollTo: jest.fn(),
    }));
    return React.createElement(
      native.View,
      { ...props, testID: 'scroll-viewport' },
      props.children,
    );
  });
  ScrollView.displayName = 'ScrollView';
  return Object.create(native, {
    ScrollView: { value: ScrollView },
    Platform: { value: { ...native.Platform, OS: 'ios' } },
  });
});

describe('AppScreen y teclado', () => {
  it('reserva solo la intersección del teclado y no duplica el ajuste de una ventana redimensionada', async () => {
    const events = new Map<string, () => void>();
    const remove = jest.fn();
    const addListener = Keyboard.addListener.bind(Keyboard);
    jest.spyOn(Keyboard, 'addListener').mockImplementation((name, listener) => {
      events.set(name, listener as () => void);
      const subscription = addListener(name, listener);
      const cleanup = subscription.remove.bind(subscription);
      jest.spyOn(subscription, 'remove').mockImplementation(() => {
        remove();
        cleanup();
      });
      return subscription;
    });
    jest
      .spyOn(Keyboard, 'metrics')
      .mockReturnValue({ screenX: 0, screenY: 500, width: 390, height: 300 });
    mockViewportHeight = 800;
    const view = await render(
      <AppScreen scroll>
        <Text>Formulario</Text>
      </AppScreen>,
    );
    await act(() => events.get('keyboardDidShow')?.());
    expect(screen.getByTestId('scroll-viewport').props.contentContainerStyle).toContainEqual({
      paddingBottom: 300,
    });
    mockViewportHeight = 500;
    await act(() => events.get('keyboardDidShow')?.());
    expect(screen.getByTestId('scroll-viewport').props.contentContainerStyle).toContainEqual({
      paddingBottom: 0,
    });
    await act(() => events.get('keyboardDidHide')?.());
    await view.unmount();
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
