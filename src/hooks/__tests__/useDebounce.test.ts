import { act, renderHook } from '@testing-library/react-native';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('actualiza el valor solo después del retraso configurado', async () => {
    const { result, rerender } = await renderHook(
      (props: { val: string }) => useDebounce(props.val, 300),
      {
        initialProps: { val: 'silla' },
      },
    );

    expect(result.current).toBe('silla');

    await rerender({ val: 'silla de ruedas' });
    expect(result.current).toBe('silla');

    await act(async () => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current).toBe('silla');

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe('silla de ruedas');
  });
});
