import * as Network from 'expo-network';

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(),
  addNetworkStateListener: jest.fn(),
}));

export function installNetworkMock(state: Network.NetworkState = { isInternetReachable: true }) {
  let listener: ((state: Network.NetworkState) => void) | undefined;
  const remove = jest.fn();
  jest.mocked(Network.getNetworkStateAsync).mockResolvedValue(state);
  jest.mocked(Network.addNetworkStateListener).mockImplementation((callback) => {
    listener = callback;
    return { remove };
  });
  return {
    remove,
    getState: jest.mocked(Network.getNetworkStateAsync),
    emit: (next: Network.NetworkState) => {
      if (!listener) throw new Error('No hay listener de red registrado.');
      listener(next);
    },
  };
}
