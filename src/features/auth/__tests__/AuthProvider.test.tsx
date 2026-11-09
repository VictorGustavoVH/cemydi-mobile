import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { createAuthSession } from '../services/auth-session';
import * as nativePush from '@/features/notifications/native-push';
import {
  AUTH_ACCOUNT,
  AUTH_SESSION,
  AUTH_USER,
  jsonResponse,
} from '../../../../tests/support/auth-api-mock';

describe('Ciclo del AuthProvider', () => {
  it('bloquea la sesión inmediatamente y espera la limpieza push sin retrasar el bloqueo local', async () => {
    const session = createAuthSession({
      get: async () => null,
      set: async () => undefined,
      remove: async () => undefined,
    });
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse(AUTH_SESSION));
    await session.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, false);
    let finishCleanup!: (value: 'cleared') => void;
    const cleanup = jest.spyOn(nativePush, 'releaseNativePush').mockImplementation(
      () =>
        new Promise((resolve) => {
          finishCleanup = resolve;
        }),
    );
    const client = new QueryClient();
    const view = await renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>
          <AuthProvider session={session}>{children}</AuthProvider>
        </QueryClientProvider>
      ),
    });
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'Sesión cerrada' }));
    let completion!: ReturnType<typeof view.result.current.logoutDetailed>;
    let completed = false;
    await act(async () => {
      completion = view.result.current.logoutDetailed();
      void completion.then(() => {
        completed = true;
      });
    });
    expect(session.getAccessToken()).toBeNull();
    expect(view.result.current.user).toBeNull();
    expect(completed).toBe(false);
    const [owner, remote, isCurrent] = cleanup.mock.calls[0]!;
    expect(owner).toBe(AUTH_USER.id);
    expect(isCurrent()).toBe(true);
    await expect(remote).resolves.toEqual({ remoteStatus: 'revoked' });
    finishCleanup('cleared');
    await expect(completion).resolves.toEqual({ remoteStatus: 'revoked', pushStatus: 'cleared' });
    await view.unmount();
    client.clear();
    cleanup.mockRestore();
  });
  it('retira la identidad y la caché privada si la cuenta está inactiva al volver', async () => {
    const remove = jest.fn(async () => undefined);
    const session = createAuthSession({
      get: async () => null,
      set: async () => undefined,
      remove,
    });
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse(AUTH_SESSION));
    await session.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, true);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const listener = jest.spyOn(AppState, 'addEventListener');
    const view = await renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>
          <AuthProvider session={session}>{children}</AuthProvider>
        </QueryClientProvider>
      ),
    });
    client.setQueryData(['private', 'profile'], AUTH_USER);
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ user: { ...AUTH_USER, activo: false } }));
    await act(async () => {
      listener.mock.calls[0][1]('active');
    });
    await waitFor(() => expect(view.result.current.status).toBe('expired'));
    expect(view.result.current.user).toBeNull();
    expect(session.getAccessToken()).toBeNull();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(['private', 'profile'])).toBeUndefined();
    await view.unmount();
    client.clear();
  });
  it('revalida al volver a foreground y elimina la caché al cerrar sesión', async () => {
    const session = createAuthSession({
      get: async () => null,
      set: async () => undefined,
      remove: async () => undefined,
    });
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse(AUTH_SESSION));
    await session.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, false);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const listener = jest.spyOn(AppState, 'addEventListener');
    const view = await renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>
          <AuthProvider session={session}>{children}</AuthProvider>
        </QueryClientProvider>
      ),
    });
    client.setQueryData(['private', 'profile'], AUTH_USER);
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ user: AUTH_USER }));
    await act(async () => {
      listener.mock.calls[0][1]('active');
    });
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        'https://cemydi.test.invalid/users/me',
        expect.objectContaining({ credentials: 'omit' }),
      ),
    );
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'Sesión cerrada' }));
    await act(async () => {
      await view.result.current.logout();
    });
    expect(view.result.current.status).toBe('guest');
    expect(client.getQueryData(['private', 'profile'])).toBeUndefined();
    expect(view.result.current.user).toBeNull();
    await view.unmount();
    client.clear();
  });
});
