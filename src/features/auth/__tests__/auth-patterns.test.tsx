import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { authSession, createAuthSession } from '../services/auth-session';
import { createAuthService } from '../services/auth-service';
import {
  AUTH_ACCOUNT,
  AUTH_SESSION,
  AUTH_USER,
  installAuthApiMock,
  jsonResponse,
} from '../../../../tests/support/auth-api-mock';

function createStorage() {
  let value: string | null = null;
  return {
    get: jest.fn(async () => value),
    set: jest.fn(async (next: string) => {
      value = next;
    }),
    remove: jest.fn(async () => {
      value = null;
    }),
  };
}

describe('Singleton modular de autenticación', () => {
  it('comparte la misma exportación entre consumidores y conserva su identidad al crear sesiones aisladas', async () => {
    const firstConsumer = jest.requireActual<typeof import('../services/auth-session')>(
      '../services/auth-session',
    );
    const secondConsumer = jest.requireActual<typeof import('../services/auth-session')>(
      '@/features/auth/services/auth-session',
    );
    const snapshot = authSession.getSnapshot();
    const isolated = createAuthSession(createStorage());

    await isolated.clear();

    expect(firstConsumer.authSession).toBe(authSession);
    expect(secondConsumer.authSession).toBe(authSession);
    expect(isolated).not.toBe(authSession);
    expect(authSession.getSnapshot()).toBe(snapshot);
    expect(createAuthService().login).toBe(authSession.login);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('usa la sesión compartida por defecto en AuthProvider sin crear otra sesión de producción', async () => {
    jest.spyOn(authSession, 'restore').mockResolvedValue(undefined);
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    const view = await renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      ),
    });
    try {
      expect(view.result.current.getSession).toBe(authSession.getSnapshot);
      expect(view.result.current.service.login).toBe(authSession.login);
      expect(authSession.restore).toHaveBeenCalledTimes(1);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      await view.unmount();
      client.clear();
    }
  });
});

describe('Factories de autenticación', () => {
  it('aísla estado, tokens, versiones, almacenamiento y listeners entre sesiones con dependencias simuladas', async () => {
    const firstStorage = createStorage();
    const secondStorage = createStorage();
    const firstTrust = jest.fn(async () => false);
    const secondTrust = jest.fn(async () => false);
    const first = createAuthSession(firstStorage, firstTrust);
    const second = createAuthSession(secondStorage, secondTrust);
    const firstListener = jest.fn();
    const secondListener = jest.fn();
    const unsubscribeFirst = first.subscribe(firstListener);
    const unsubscribeSecond = second.subscribe(secondListener);
    try {
      jest.mocked(fetch).mockResolvedValueOnce(jsonResponse(AUTH_SESSION));
      await first.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, true);
      expect(first).not.toBe(second);
      expect(first.getSnapshot().status).toBe('authenticated');
      expect(firstStorage.set).toHaveBeenCalledWith(AUTH_SESSION.refreshToken);
      expect(firstTrust).toHaveBeenCalledTimes(1);
      expect(secondTrust).not.toHaveBeenCalled();
      expect(second.getSnapshot().status).toBe('loading');
      expect(second.getAccessToken()).toBeNull();
      expect(second.getVersion()).toBe(0);
      expect(secondListener).not.toHaveBeenCalled();
      expect(secondStorage.set).not.toHaveBeenCalled();

      const secondUser = { ...AUTH_USER, id: 2, correo: 'otra-cuenta@cemydi.test' };
      jest.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({
          ...AUTH_SESSION,
          user: secondUser,
          accessToken: 'second-fixture-access',
          refreshToken: 'b'.repeat(64),
        }),
      );
      await second.login(secondUser.correo, AUTH_ACCOUNT.password, true);
      const secondSnapshot = second.getSnapshot();
      const secondVersion = second.getVersion();
      await first.clear();

      expect(first.getSnapshot().status).toBe('guest');
      expect(first.getAccessToken()).toBeNull();
      expect(await firstStorage.get()).toBeNull();
      expect(second.getSnapshot()).toBe(secondSnapshot);
      expect(second.getSnapshot().user).toEqual(secondUser);
      expect(second.getVersion()).toBe(secondVersion);
      expect(second.getAccessToken()).toBe('second-fixture-access');
      expect(await secondStorage.get()).toBe('b'.repeat(64));
      expect(secondTrust).toHaveBeenCalledTimes(1);
      expect(firstListener).toHaveBeenCalledTimes(2);
      expect(secondListener).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribeFirst();
      unsubscribeSecond();
    }
  });

  it('delega login en la sesión inyectada sin utilizar la sesión compartida ni HTTP', async () => {
    const session = createAuthSession(createStorage());
    const login = jest.spyOn(session, 'login').mockResolvedValue(undefined);
    const service = createAuthService(session);
    const sharedSnapshot = authSession.getSnapshot();

    await service.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, false);

    expect(login).toHaveBeenCalledWith(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, false);
    expect(authSession.getSnapshot()).toBe(sharedSnapshot);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('mantiene desafíos, códigos verificados y cancelaciones independientes entre servicios', async () => {
    installAuthApiMock();
    const session = createAuthSession(createStorage());
    const clear = jest.spyOn(session, 'clear').mockResolvedValue(undefined);
    const first = createAuthService(session);
    const second = createAuthService(session);
    expect(first).not.toBe(second);

    await first.requestRecovery(AUTH_ACCOUNT.correo);
    await first.verify('00000000');
    await second.requestRecovery('otra-cuenta@cemydi.test');
    await expect(second.resetPassword('NuevaPassword1!')).rejects.toThrow('Primero verifica');
    first.cancelChallenge();
    await second.verify('00000000');
    await second.resetPassword('NuevaPassword1!');

    expect(clear).toHaveBeenCalledTimes(1);
    expect(jest.mocked(fetch).mock.calls.at(-1)?.[1]?.body).toBe(
      JSON.stringify({
        correo: 'otra-cuenta@cemydi.test',
        codigo: '00000000',
        newPassword: 'NuevaPassword1!',
      }),
    );
    const requests = jest.mocked(fetch).mock.calls.length;
    await expect(first.verify('00000000')).rejects.toThrow('Primero solicita');
    expect(fetch).toHaveBeenCalledTimes(requests);
  });
});

describe('Observer de sesión', () => {
  it('mantiene el snapshot estable entre lecturas y publica uno nuevo sin mutar el anterior', async () => {
    const session = createAuthSession(createStorage());
    const initial = session.getSnapshot();
    expect(session.getSnapshot()).toBe(initial);

    await session.clear();

    expect(session.getSnapshot()).not.toBe(initial);
    expect(session.getSnapshot().status).toBe('guest');
    expect(session.getSnapshot()).toBe(session.getSnapshot());
    expect(initial.status).toBe('loading');
  });

  it('notifica a varios suscriptores con el snapshot publicado y deja de notificar tras cancelar', async () => {
    const session = createAuthSession(createStorage());
    const first = jest.fn(() => session.getSnapshot());
    const second = jest.fn(() => session.getSnapshot());
    const unsubscribeFirst = session.subscribe(first);
    const unsubscribeSecond = session.subscribe(second);
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();

    await session.clear();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first.mock.results[0].value).toBe(session.getSnapshot());
    expect(second.mock.results[0].value).toBe(session.getSnapshot());

    unsubscribeFirst();
    unsubscribeFirst();
    await session.expire();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    expect(second.mock.results[1].value.status).toBe('expired');

    unsubscribeSecond();
    await session.clear();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('actualiza consumidores React y limpia todas las suscripciones del provider al desmontar', async () => {
    const session = createAuthSession(createStorage());
    await session.restore();
    const subscribe = session.subscribe;
    const subscriptions: { notify: jest.Mock; unsubscribe: jest.Mock }[] = [];
    jest.spyOn(session, 'subscribe').mockImplementation((listener) => {
      const notify = jest.fn(listener);
      const unsubscribe = jest.fn(subscribe(notify));
      subscriptions.push({ notify, unsubscribe });
      return unsubscribe;
    });
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const view = await renderHook(() => ({ first: useAuth(), second: useAuth() }), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>
          <AuthProvider session={session}>{children}</AuthProvider>
        </QueryClientProvider>
      ),
    });
    let mounted = true;
    try {
      const service = view.result.current.first.service;
      jest.mocked(fetch).mockResolvedValueOnce(jsonResponse(AUTH_SESSION));
      await act(async () => {
        await session.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, false);
      });
      expect(view.result.current.first.user).toEqual(AUTH_USER);
      expect(view.result.current.second.user).toEqual(AUTH_USER);
      expect(view.result.current.first.getSession()).toBe(session.getSnapshot());
      expect(view.result.current.first.service).toBe(service);
      // useSyncExternalStore y el efecto de limpieza de caché se suscriben a la misma sesión.
      expect(subscriptions.length).toBeGreaterThanOrEqual(2);
      expect(subscriptions.every(({ notify }) => notify.mock.calls.length > 0)).toBe(true);
      await view.unmount();
      mounted = false;
      expect(subscriptions.every(({ unsubscribe }) => unsubscribe.mock.calls.length === 1)).toBe(
        true,
      );
      expect(remove).toHaveBeenCalledTimes(1);

      const calls = subscriptions.map(({ notify }) => notify.mock.calls.length);
      client.setQueryData(['private', 'after-unmount'], 'conservado');
      await session.clear();
      expect(subscriptions.map(({ notify }) => notify.mock.calls.length)).toEqual(calls);
      expect(client.getQueryData(['private', 'after-unmount'])).toBe('conservado');
    } finally {
      if (mounted) await view.unmount();
      client.clear();
    }
  });
});
