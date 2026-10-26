import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { createAuthSession } from '../services/auth-session';
import {
  AUTH_ACCOUNT,
  AUTH_SESSION,
  AUTH_USER,
  jsonResponse,
} from '../../../../tests/support/auth-api-mock';

describe('Ciclo del AuthProvider', () => {
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
