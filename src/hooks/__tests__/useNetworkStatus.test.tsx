import { act, renderHook, waitFor } from '@testing-library/react-native';
import type * as Network from 'expo-network';
import { installNetworkMock } from '../../../tests/support/network-mock';
import { useNetworkStatus } from '../useNetworkStatus';

describe('useNetworkStatus con Expo Network simulado', () => {
  it('conserva el evento más reciente cuando la consulta inicial termina después', async () => {
    const network = installNetworkMock();
    let resolve!: (state: Network.NetworkState) => void;
    network.getState.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result } = await renderHook(useNetworkStatus);
    await act(() => network.emit({ isInternetReachable: false }));
    await act(() => resolve({ isInternetReachable: true }));
    expect(result.current.isOnline).toBe(false);
  });

  it('prioriza alcance de internet y escucha pérdida y recuperación de conexión', async () => {
    const network = installNetworkMock({ isConnected: true, isInternetReachable: false });
    const { result, unmount } = await renderHook(useNetworkStatus);
    await waitFor(() => expect(result.current.isOnline).toBe(false));
    await act(() => network.emit({ isInternetReachable: true }));
    expect(result.current.isOnline).toBe(true);
    await act(() => network.emit({ isConnected: false }));
    expect(result.current.isOnline).toBe(false);
    await unmount();
    expect(network.remove).toHaveBeenCalledTimes(1);
  });

  it('considera online un estado desconocido o una consulta nativa fallida', async () => {
    const network = installNetworkMock({});
    const view = await renderHook(useNetworkStatus);
    await waitFor(() => expect(view.result.current.isOnline).toBe(true));
    await view.unmount();
    network.getState.mockRejectedValueOnce(new Error('Sin permiso'));
    const { result } = await renderHook(useNetworkStatus);
    await waitFor(() => expect(result.current.isOnline).toBe(true));
  });

  it('ignora una consulta inicial que termina después de desmontar', async () => {
    const network = installNetworkMock();
    let resolve!: (state: Network.NetworkState) => void;
    network.getState.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { unmount } = await renderHook(useNetworkStatus);
    await unmount();
    await act(() => resolve({ isInternetReachable: false }));
    expect(network.remove).toHaveBeenCalledTimes(1);
  });
});
