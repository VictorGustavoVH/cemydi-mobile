import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import type { NetworkState } from 'expo-network';
import {
  focusManager,
  onlineManager,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { installNetworkMock } from '../support/network-mock';
import { QueryProvider } from '@/providers/query-provider';
import { httpClient } from '@/services/http/client';

const clients = new Set<QueryClient>();
const initialAppState = AppState.currentState;

function useTransportProbe() {
  const client = useQueryClient();
  clients.add(client);
  const query = useQuery({
    queryKey: ['test', 'public-root'],
    queryFn: ({ signal }) => httpClient.request<string>('/', { signal }),
  });
  return { client, query };
}

beforeEach(() => {
  AppState.currentState = 'active';
  onlineManager.setOnline(true);
  focusManager.setFocused(true);
});

afterEach(() => {
  AppState.currentState = initialAppState;
  clients.forEach((client) => client.clear());
  clients.clear();
  onlineManager.setEventListener(() => undefined);
  onlineManager.setOnline(true);
  focusManager.setFocused(undefined);
});

describe('QueryProvider, Expo Network y transporte HTTP real con fetch simulado', () => {
  it('ignora la consulta nativa inicial después de desmontar el provider', async () => {
    const network = installNetworkMock();
    let resolve!: (state: NetworkState) => void;
    network.getState.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const view = await renderHook(useQueryClient, { wrapper: QueryProvider });
    await view.unmount();
    onlineManager.setOnline(false);
    await act(() => resolve({ isInternetReachable: true }));
    expect(onlineManager.isOnline()).toBe(false);
    expect(network.remove).toHaveBeenCalledTimes(1);
    view.result.current.clear();
  });

  it('reintenta errores de red hasta recuperar datos con la política real del provider', async () => {
    installNetworkMock();
    jest
      .mocked(fetch)
      .mockRejectedValueOnce(new Error('Sin red'))
      .mockRejectedValueOnce(new Error('Sin red'))
      .mockResolvedValueOnce(new Response('Hello World!', { status: 200 }));
    const view = await renderHook(useTransportProbe, { wrapper: QueryProvider });
    await waitFor(() => expect(view.result.current.query.data).toBe('Hello World!'), {
      timeout: 5000,
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    await view.unmount();
  });

  it('comparte caché entre consumidores y limpia la suscripción nativa', async () => {
    const network = installNetworkMock();
    jest.mocked(fetch).mockResolvedValueOnce(new Response('Hello World!', { status: 200 }));
    const view = await renderHook(
      () => ({ first: useTransportProbe(), second: useTransportProbe() }),
      { wrapper: QueryProvider },
    );
    await waitFor(() => expect(view.result.current.first.query.data).toBe('Hello World!'));
    expect(view.result.current.second.query.data).toBe('Hello World!');
    expect(view.result.current.first.client).toBe(view.result.current.second.client);
    expect(fetch).toHaveBeenCalledTimes(1);
    await view.unmount();
    view.result.current.first.client.clear();
    expect(network.remove).toHaveBeenCalledTimes(1);
  });

  it('pausa queries offline y continúa al recuperar conexión', async () => {
    const network = installNetworkMock({ isInternetReachable: false });
    onlineManager.setOnline(false);
    jest.mocked(fetch).mockResolvedValueOnce(new Response('Hello World!', { status: 200 }));
    const view = await renderHook(useTransportProbe, { wrapper: QueryProvider });
    expect(view.result.current.query.fetchStatus).toBe('paused');
    expect(fetch).not.toHaveBeenCalled();
    await act(() => network.emit({ isInternetReachable: true }));
    await waitFor(() => expect(view.result.current.query.data).toBe('Hello World!'));
    expect(fetch).toHaveBeenCalledTimes(1);
    await view.unmount();
    view.result.current.client.clear();
  });

  it('presenta un error HTTP sin reintentar 4xx y permite refetch explícito', async () => {
    installNetworkMock();
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        new Response('{"message":"No disponible"}', {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response('Hello World!', { status: 200 }));
    const view = await renderHook(useTransportProbe, { wrapper: QueryProvider });
    await waitFor(() => expect(view.result.current.query.isError).toBe(true));
    expect(view.result.current.query.error).toMatchObject({ kind: 'http', status: 404 });
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(() => view.result.current.query.refetch());
    await waitFor(() => expect(view.result.current.query.data).toBe('Hello World!'));
    await view.unmount();
    view.result.current.client.clear();
  });
});
