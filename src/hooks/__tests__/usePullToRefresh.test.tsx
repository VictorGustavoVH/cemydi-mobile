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
