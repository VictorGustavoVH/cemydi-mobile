import { act, renderHook, waitFor } from '@testing-library/react-native';

import { usePullToRefresh } from '../usePullToRefresh';

function createDeferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('usePullToRefresh', () => {
  it('detiene el indicador al perder conexión y una petición anterior no cierra una recarga nueva', async () => {
    const previous = createDeferred();
    const next = createDeferred();
    const refresh = jest
      .fn()
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(next.promise);
    const { result, rerender } = await renderHook(
      ({ enabled }: { enabled: boolean }) => usePullToRefresh(refresh, { enabled }),
      { initialProps: { enabled: true } },
    );
    await act(async () => result.current.onRefresh());
    expect(result.current.refreshing).toBe(true);
    await rerender({ enabled: false });
    expect(result.current.refreshing).toBe(false);
    await rerender({ enabled: true });
    await act(async () => result.current.onRefresh());
    await act(async () => {
      previous.resolve();
    });
    expect(result.current.refreshing).toBe(true);
    await act(async () => {
      next.resolve();
    });
    expect(result.current.refreshing).toBe(false);
  });
  it('marca refreshing solo mientras dura la recarga iniciada por el usuario', async () => {
    const deferred = createDeferred();
    const refresh = jest.fn(() => deferred.promise);
    const { result } = await renderHook(() => usePullToRefresh(refresh));

    expect(result.current.refreshing).toBe(false);
    await act(async () => result.current.onRefresh());
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.current.refreshing).toBe(true);

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });
    await waitFor(() => expect(result.current.refreshing).toBe(false));
  });

  it('ignora un segundo gesto mientras la recarga está en curso', async () => {
    const deferred = createDeferred();
    const refresh = jest.fn(() => deferred.promise);
    const { result } = await renderHook(() => usePullToRefresh(refresh));

    await act(async () => {
      result.current.onRefresh();
      result.current.onRefresh();
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });
    await waitFor(() => expect(result.current.refreshing).toBe(false));

    await act(async () => result.current.onRefresh());
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('no recarga ni muestra el indicador cuando está deshabilitado', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);
    const { result } = await renderHook(() => usePullToRefresh(refresh, { enabled: false }));

    await act(async () => result.current.onRefresh());
    expect(refresh).not.toHaveBeenCalled();
    expect(result.current.refreshing).toBe(false);
  });

  it('limpia el indicador aunque la recarga falle', async () => {
    const deferred = createDeferred();
    const refresh = jest.fn(() => deferred.promise);
    const { result } = await renderHook(() => usePullToRefresh(refresh));

    await act(async () => result.current.onRefresh());
    expect(result.current.refreshing).toBe(true);

    await act(async () => {
      deferred.reject(new Error('sin conexión'));
      await deferred.promise.catch(() => undefined);
    });
    await waitFor(() => expect(result.current.refreshing).toBe(false));
  });
});
