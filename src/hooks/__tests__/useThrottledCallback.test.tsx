import { fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { useThrottledCallback } from '../useThrottledCallback';

function TestThrottledComponent({
  onAction,
  delayMs = 500,
}: {
  onAction: (val?: string) => void;
  delayMs?: number;
}) {
  const throttledAction = useThrottledCallback(onAction, delayMs);
  return (
    <Pressable testID="btn" onPress={() => throttledAction('click')}>
      <Text>Click</Text>
    </Pressable>
  );
}

describe('useThrottledCallback', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ejecuta la función en la primera pulsación', async () => {
    const onAction = jest.fn();
    const { getByTestId } = await render(<TestThrottledComponent onAction={onAction} />);

    await fireEvent.press(getByTestId('btn'));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith('click');
  });

  it('ignora pulsaciones adicionales dentro del intervalo de tiempo', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);

    const onAction = jest.fn();
    const { getByTestId } = await render(<TestThrottledComponent onAction={onAction} />);

    await fireEvent.press(getByTestId('btn'));

    nowSpy.mockReturnValue(1200);
    await fireEvent.press(getByTestId('btn'));

    nowSpy.mockReturnValue(1400);
    await fireEvent.press(getByTestId('btn'));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('permite una nueva pulsación una vez transcurrido el tiempo de espera', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);

    const onAction = jest.fn();
    const { getByTestId } = await render(<TestThrottledComponent onAction={onAction} />);

    await fireEvent.press(getByTestId('btn'));
    expect(onAction).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(1600);
    await fireEvent.press(getByTestId('btn'));

    expect(onAction).toHaveBeenCalledTimes(2);
  });
});
