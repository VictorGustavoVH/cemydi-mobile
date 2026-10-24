import { createAuthSession } from '../services/auth-session';
import { configureHttpAuth, httpClient } from '@/services/http/client';
import {
  AUTH_ACCOUNT,
  AUTH_SESSION,
  AUTH_USER,
  jsonResponse,
} from '../../../../tests/support/auth-api-mock';

function setup(token: string | null = null, isCompromisedDevice = async () => false) {
  let saved = token;
  const storage = {
    get: jest.fn(async () => saved),
    set: jest.fn(async (value: string) => {
      saved = value;
    }),
    remove: jest.fn(async () => {
      saved = null;
    }),
  };
  const session = createAuthSession(storage, isCompromisedDevice);
  configureHttpAuth({
    getAccessToken: session.getAccessToken,
    getVersion: session.getVersion,
    refresh: session.refresh,
    expired: session.expire,
  });
  return { session, storage, saved: () => saved };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function login(session: ReturnType<typeof createAuthSession>, remember = true) {
  jest.mocked(fetch).mockResolvedValueOnce(jsonResponse(AUTH_SESSION));
  await session.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, remember);
}

describe('Sesión móvil y cliente autenticado', () => {
  it('rechaza Google en un dispositivo comprometido sin enviar el ID token', async () => {
    const { session, storage } = setup(null, async () => true);
    await expect(session.loginWithGoogle('google-id-token', true)).rejects.toThrow(
      'root o jailbreak',
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
  });
  it('inicia Google por el endpoint móvil y guarda solo refresh', async () => {
    const { session, storage } = setup();
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse(AUTH_SESSION));
    await session.loginWithGoogle('google-id-token', true);
    expect(fetch).toHaveBeenCalledWith(
      'https://cemydi.test.invalid/auth/mobile/google',
      expect.objectContaining({ body: JSON.stringify({ idToken: 'google-id-token' }) }),
    );
    expect(storage.set).toHaveBeenCalledWith(AUTH_SESSION.refreshToken);
    expect(session.getSnapshot().status).toBe('authenticated');
  });
  it('elimina refresh persistido si detecta root durante la restauración', async () => {
    const { session, saved } = setup(AUTH_SESSION.refreshToken, async () => true);
    await session.restore();
    expect(session.getSnapshot().status).toBe('error');
    expect(saved()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('cierra la sesión al detectar root cuando la app vuelve al primer plano', async () => {
    let compromised = false;
    const { session, saved } = setup(null, async () => compromised);
    await login(session);
    compromised = true;
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'Sesión cerrada' }));
    await expect(session.revalidate()).rejects.toThrow('root o jailbreak');
    expect(session.getSnapshot().status).toBe('error');
    expect(session.getAccessToken()).toBeNull();
    expect(saved()).toBeNull();
  });
  it('conserva el perfil guardado mientras renueva tokens de una consulta anterior', async () => {
    const { session } = setup();
    await login(session);
    const response = deferred<Response>();
    jest.mocked(fetch).mockReturnValueOnce(response.promise);
    const pending = session.refresh();
    session.updateUser({ ...AUTH_USER, nombre: 'Nombre actualizado' }, session.getVersion());
    response.resolve(
      jsonResponse({
        ...AUTH_SESSION,
        accessToken: 'rotated-access',
        refreshToken: 'b'.repeat(64),
      }),
    );
    await pending;
    expect(session.getSnapshot().user?.nombre).toBe('Nombre actualizado');
    expect(session.getAccessToken()).toBe('rotated-access');
  });
  it('actualiza identidad sin tocar tokens y descarta una revalidación anterior al guardado', async () => {
    const { session, storage } = setup();
    await login(session);
    const version = session.getVersion();
    const response = deferred<Response>();
    jest.mocked(fetch).mockReturnValueOnce(response.promise);
    const pending = session.revalidate();
    await new Promise((resolve) => setTimeout(resolve, 0));
    session.updateUser({ ...AUTH_USER, nombre: 'Nombre actualizado' }, version);
    response.resolve(jsonResponse({ user: AUTH_USER }));
    await pending;
    expect(session.getSnapshot().user?.nombre).toBe('Nombre actualizado');
    expect(session.getAccessToken()).toBe(AUTH_SESSION.accessToken);
    expect(session.getVersion()).toBe(version);
    expect(storage.set).toHaveBeenCalledTimes(1);
    await session.clear();
    expect(() => session.updateUser(AUTH_USER, version)).toThrow('La sesión cambió');
    expect(session.getSnapshot().user).toBeNull();
  });
  it('guarda solo refresh cuando se solicita persistencia y restaura con rotación', async () => {
    const { session, storage } = setup();
    await login(session);
    expect(storage.set).toHaveBeenCalledWith(AUTH_SESSION.refreshToken);
    expect(storage.set).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot()).toMatchObject({ status: 'authenticated', user: AUTH_USER });
    const restored = createAuthSession(storage);
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ ...AUTH_SESSION, refreshToken: 'b'.repeat(64) }));
    await restored.restore();
    expect(storage.set).toHaveBeenLastCalledWith('b'.repeat(64));
    expect(restored.getSnapshot().user).toEqual(AUTH_USER);
    expect(jest.mocked(fetch).mock.calls[1][1]).toMatchObject({
      credentials: 'omit',
      body: JSON.stringify({ refreshToken: AUTH_SESSION.refreshToken }),
    });
  });
  it('sin mantener sesión no persiste tokens, incluso después de renovar', async () => {
    const { session, storage } = setup();
    await login(session, false);
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse(AUTH_SESSION));
    await session.refresh();
    expect(storage.set).not.toHaveBeenCalled();
    expect(storage.remove).toHaveBeenCalledTimes(1);
  });
  it('rechaza contratos incompletos y no guarda credenciales', async () => {
    const { session, storage } = setup();
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ user: AUTH_USER }));
    await expect(
      session.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, true),
    ).rejects.toMatchObject({ kind: 'parse' });
    expect(storage.set).not.toHaveBeenCalled();
    expect(session.getSnapshot().user).toBeNull();
  });
  it('conserva la credencial durante un fallo de red y permite reintentar', async () => {
    const { session, storage, saved } = setup(AUTH_SESSION.refreshToken);
    await session.restore();
    expect(session.getSnapshot().status).toBe('error');
    expect(saved()).toBe(AUTH_SESSION.refreshToken);
    expect(storage.remove).not.toHaveBeenCalled();
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse(AUTH_SESSION));
    await session.restore();
    expect(session.getSnapshot().status).toBe('authenticated');
  });
  it('elimina sesión revocada sin reintentos ni bucles', async () => {
    const { session, saved } = setup(AUTH_SESSION.refreshToken);
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'Sesion invalida' }, 401));
    await session.restore();
    expect(session.getSnapshot().status).toBe('expired');
    expect(saved()).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('coordina varios 401 en un solo refresh y repite cada lectura una vez', async () => {
    const { session } = setup();
    await login(session);
    const rotation = deferred<Response>();
    jest.mocked(fetch).mockImplementation(async (url, options) => {
      if (String(url).endsWith('/auth/mobile/refresh')) return rotation.promise;
      return new Headers(options?.headers).get('Authorization') === 'Bearer rotated'
        ? jsonResponse({ user: AUTH_USER })
        : jsonResponse({}, 401);
    });
    const first = httpClient.request('/users/me', { authenticated: true });
    const second = httpClient.request('/users/me', { authenticated: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    rotation.resolve(jsonResponse({ ...AUTH_SESSION, accessToken: 'rotated' }));
    await expect(Promise.all([first, second])).resolves.toEqual([
      { user: AUTH_USER },
      { user: AUTH_USER },
    ]);
    expect(
      jest.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/auth/mobile/refresh')),
    ).toHaveLength(1);
    expect(
      jest.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/users/me')),
    ).toHaveLength(4);
  });
  it('termina sesión si el segundo intento sigue devolviendo 401', async () => {
    const { session, saved } = setup();
    await login(session);
    jest
      .mocked(fetch)
      .mockImplementation(async (url) =>
        String(url).endsWith('/auth/mobile/refresh')
          ? jsonResponse(AUTH_SESSION)
          : jsonResponse({}, 401),
      );
    await expect(httpClient.request('/users/me', { authenticated: true })).rejects.toMatchObject({
      status: 401,
    });
    expect(session.getSnapshot().status).toBe('expired');
    expect(saved()).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(4);
  });
  it('una respuesta de refresh tardía no restaura la sesión después de limpiarla', async () => {
    const { session, saved } = setup();
    await login(session);
    const response = deferred<Response>();
    jest.mocked(fetch).mockReturnValueOnce(response.promise);
    const pending = session.refresh();
    await session.clear();
    response.resolve(jsonResponse({ ...AUTH_SESSION, refreshToken: 'b'.repeat(64) }));
    await pending;
    expect(session.getSnapshot().status).toBe('guest');
    expect(session.getAccessToken()).toBeNull();
    expect(saved()).toBeNull();
  });
  it('revoca en el servidor y borra las credenciales al salir', async () => {
    const { session, saved } = setup();
    await login(session);
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'Sesión cerrada' }));
    await session.logout();
    expect(jest.mocked(fetch).mock.calls[1]).toEqual([
      'https://cemydi.test.invalid/auth/mobile/logout',
      expect.objectContaining({
        body: JSON.stringify({ refreshToken: AUTH_SESSION.refreshToken }),
      }),
    ]);
    expect(saved()).toBeNull();
    expect(session.getSnapshot().status).toBe('guest');
  });
  it('cierra localmente aunque falle la revocación', async () => {
    const { session } = setup();
    await login(session);
    await expect(session.logout()).resolves.toEqual({ remoteStatus: 'failed' });
    expect(session.getSnapshot().status).toBe('guest');
  });
  it('bloquea acceso de inmediato aunque la revocación remota quede pendiente', async () => {
    const { session, saved } = setup();
    await login(session);
    const response = deferred<Response>();
    jest.mocked(fetch).mockReturnValueOnce(response.promise);
    const pending = session.logout();
    expect(session.getAccessToken()).toBeNull();
    expect(session.getSnapshot().status).toBe('guest');
    await expect(pending).resolves.toEqual({ remoteStatus: 'pending' });
    expect(saved()).toBeNull();
    response.resolve(jsonResponse({ message: 'Sesión cerrada' }));
  });
  it('deja un marcador cuando SecureStore no puede eliminar el refresh token', async () => {
    const { session, storage, saved } = setup();
    await login(session);
    storage.remove.mockRejectedValueOnce(new Error('storage unavailable'));
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'Sesión cerrada' }));
    await expect(session.logout()).resolves.toEqual({ remoteStatus: 'revoked' });
    expect(saved()).toBe('cemydi.mobile.logged-out');
    const restored = createAuthSession(storage);
    await restored.restore();
    expect(restored.getSnapshot().status).toBe('guest');
  });
  it('informa fallo local y deja reintentar si SecureStore no elimina ni sobrescribe', async () => {
    const { session, storage } = setup();
    await login(session);
    storage.remove.mockRejectedValueOnce(new Error('storage unavailable'));
    storage.set.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(session.logout()).rejects.toThrow('Reintenta cerrar sesión');
    expect(session.getSnapshot().status).toBe('error');
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'Sesión cerrada' }));
    await expect(session.logout()).resolves.toEqual({ remoteStatus: 'revoked' });
    expect(session.getSnapshot().status).toBe('guest');
  });
  it('revoca también un refresh que termina después del plazo de logout', async () => {
    const { session, saved } = setup();
    await login(session);
    const rotation = deferred<Response>();
    jest.mocked(fetch).mockReturnValueOnce(rotation.promise);
    const pendingRefresh = session.refresh();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const pendingLogout = session.logout();
    await expect(pendingLogout).resolves.toEqual({ remoteStatus: 'pending' });
    const rotated = 'b'.repeat(64);
    jest.mocked(fetch).mockResolvedValue(jsonResponse({ message: 'Sesión cerrada' }));
    rotation.resolve(jsonResponse({ ...AUTH_SESSION, refreshToken: rotated }));
    await pendingRefresh;
    await new Promise((resolve) => setTimeout(resolve, 0));
    const revoked = jest
      .mocked(fetch)
      .mock.calls.filter(([url]) => String(url).endsWith('/auth/mobile/logout'))
      .map(([, options]) => JSON.parse(String(options?.body)).refreshToken);
    expect(revoked).toContain(rotated);
    expect(saved()).toBeNull();
    expect(session.getSnapshot().status).toBe('guest');
  });
  it('bloquea nuevas rotaciones mientras revoca la sesión', async () => {
    const { session } = setup();
    await login(session);
    const response = deferred<Response>();
    jest.mocked(fetch).mockReturnValueOnce(response.promise);
    const pending = session.logout();
    await expect(session.refresh()).rejects.toMatchObject({ kind: 'abort' });
    response.resolve(jsonResponse({ message: 'Sesión cerrada' }));
    await pending;
    expect(session.getSnapshot().status).toBe('guest');
    expect(
      jest.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/auth/mobile/refresh')),
    ).toHaveLength(0);
  });
  it('revoca un login tardío si la sesión se limpió mientras esperaba la respuesta', async () => {
    const { session, saved } = setup();
    const response = deferred<Response>();
    jest
      .mocked(fetch)
      .mockReturnValueOnce(response.promise)
      .mockResolvedValueOnce(jsonResponse({ message: 'Sesión cerrada' }));
    const pending = session.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await session.clear();
    response.resolve(jsonResponse(AUTH_SESSION));
    await expect(pending).rejects.toThrow('cancelado');
    expect(jest.mocked(fetch).mock.calls[1][0]).toBe(
      'https://cemydi.test.invalid/auth/mobile/logout',
    );
    expect(session.getSnapshot().status).toBe('guest');
    expect(saved()).toBeNull();
  });
  it('no repite una operación anterior usando la cuenta recién iniciada', async () => {
    const { session } = setup();
    await login(session);
    const response = deferred<Response>();
    jest.mocked(fetch).mockReturnValueOnce(response.promise);
    const request = httpClient.request('/users/me', { authenticated: true });
    await session.clear();
    await login(session);
    response.resolve(jsonResponse({}, 401));
    await expect(request).rejects.toMatchObject({ kind: 'abort' });
    expect(session.getSnapshot().status).toBe('authenticated');
  });
});
