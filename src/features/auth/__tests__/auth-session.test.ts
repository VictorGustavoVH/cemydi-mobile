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
  it.each([null, { ...AUTH_USER, activo: false }])(
    'expira y elimina las credenciales al revalidar una identidad ausente o inactiva: %j',
    async (user) => {
      const { session, storage, saved } = setup();
      await login(session);
      const version = session.getVersion();
      jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ user }));
      await session.revalidate();
      expect(session.getSnapshot()).toEqual({ user: null, status: 'expired', error: null });
      expect(session.getAccessToken()).toBeNull();
      expect(saved()).toBeNull();
      expect(storage.remove).toHaveBeenCalledTimes(1);
      expect(session.getVersion()).toBeGreaterThan(version);
      await session.refresh();
      expect(fetch).toHaveBeenCalledTimes(2);
    },
  );
  it('una edición de perfil no oculta la desactivación informada por el servidor', async () => {
    const { session, saved } = setup();
    await login(session);
    const response = deferred<Response>();
    jest.mocked(fetch).mockReturnValueOnce(response.promise);
    const pending = session.revalidate();
    await new Promise((resolve) => setTimeout(resolve, 0));
    session.updateUser({ ...AUTH_USER, nombre: 'Nombre actualizado' }, session.getVersion());
    response.resolve(jsonResponse({ user: { ...AUTH_USER, activo: false } }));
    await pending;
    expect(session.getSnapshot().status).toBe('expired');
    expect(session.getAccessToken()).toBeNull();
    expect(saved()).toBeNull();
  });
  it('una revalidación inactiva de una sesión anterior no cierra la sesión nueva', async () => {
    const { session, saved } = setup();
    await login(session);
    const response = deferred<Response>();
    jest.mocked(fetch).mockReturnValueOnce(response.promise);
    const pending = session.revalidate();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await session.clear();
    await login(session);
    response.resolve(jsonResponse({ user: { ...AUTH_USER, activo: false } }));
    await expect(pending).rejects.toMatchObject({ kind: 'abort' });
    expect(session.getSnapshot().status).toBe('authenticated');
    expect(saved()).toBe(AUTH_SESSION.refreshToken);
  });
  it('conserva una sesión activa al revalidar y no cambia credenciales ante un fallo de red', async () => {
    const { session, saved } = setup();
    await login(session);
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ user: AUTH_USER }));
    await session.revalidate();
    jest.mocked(fetch).mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(session.revalidate()).rejects.toMatchObject({ kind: 'network' });
    expect(session.getSnapshot()).toMatchObject({ status: 'authenticated', user: AUTH_USER });
    expect(session.getAccessToken()).toBe(AUTH_SESSION.accessToken);
    expect(saved()).toBe(AUTH_SESSION.refreshToken);
  });
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

  describe('NOV-01: Renovación JWT y SecureStore', () => {
    it('TEST-01. Renovación exitosa: backend devuelve nuevas credenciales y SecureStore las guarda', async () => {
      const { session, storage, saved } = setup();
      await login(session, true);
      expect(saved()).toBe(AUTH_SESSION.refreshToken);
      const rotated = 'b'.repeat(64);
      jest.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({
          ...AUTH_SESSION,
          accessToken: 'new-access-token',
          refreshToken: rotated,
        }),
      );
      await session.refresh();
      expect(session.getSnapshot().status).toBe('authenticated');
      expect(session.getAccessToken()).toBe('new-access-token');
      expect(saved()).toBe(rotated);
      expect(storage.set).toHaveBeenLastCalledWith(rotated);
    });

    it('TEST-02. Fallo de escritura tras rotación exitosa: mantiene sesión en memoria y elimina token obsoleto de SecureStore sin falsa persistencia', async () => {
      const { session, storage, saved } = setup();
      await login(session, true);
      const rotated = 'b'.repeat(64);
      storage.set.mockRejectedValueOnce(new Error('SecureStore disk error'));
      jest.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({
          ...AUTH_SESSION,
          accessToken: 'rotated-access',
          refreshToken: rotated,
        }),
      );
      await session.refresh();
      expect(session.getSnapshot().status).toBe('authenticated');
      expect(session.getSnapshot().user).toEqual(AUTH_USER);
      expect(session.getSnapshot().error).toBeNull();
      expect(session.getAccessToken()).toBe('rotated-access');
      expect(storage.set).toHaveBeenCalledWith(rotated);
      expect(storage.remove).toHaveBeenCalledTimes(1);
      expect(saved()).toBeNull();
    });

    it('TEST-03. Reintento posterior al fallo de almacenamiento: utiliza exclusivamente la credencial vigente en memoria', async () => {
      const { session, storage } = setup();
      await login(session, true);
      // login llamó a storage.set 1 vez
      expect(storage.set).toHaveBeenCalledTimes(1);

      const rotated = 'b'.repeat(64);
      storage.set.mockRejectedValueOnce(new Error('SecureStore write failed'));
      jest.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({
          ...AUTH_SESSION,
          accessToken: 'rotated-access',
          refreshToken: rotated,
        }),
      );
      await session.refresh();
      expect(session.getAccessToken()).toBe('rotated-access');
      // Primer refresh intentó guardar y falló (segunda llamada a storage.set)
      expect(storage.set).toHaveBeenCalledTimes(2);

      // Segundo refresh en la misma sesión activa
      const thirdRotated = 'c'.repeat(64);
      jest.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({
          ...AUTH_SESSION,
          accessToken: 'third-access',
          refreshToken: thirdRotated,
        }),
      );
      await session.refresh();

      // Comprobar que envió el refresh token vigente en memoria ('b'.repeat(64)), no el inicial
      const lastFetchCall = jest.mocked(fetch).mock.calls[jest.mocked(fetch).mock.calls.length - 1];
      expect(lastFetchCall[0]).toBe('https://cemydi.test.invalid/auth/mobile/refresh');
      expect(JSON.parse(String(lastFetchCall[1]?.body))).toEqual({ refreshToken: rotated });
      expect(session.getAccessToken()).toBe('third-access');
      expect(session.getSnapshot().status).toBe('authenticated');
      // Como la persistencia se deshabilitó tras el fallo previo, no vuelve a intentar escribir en SecureStore
      expect(storage.set).toHaveBeenCalledTimes(2);
    });

    it('TEST-04. Reinicio simulado: no restaura indebidamente una sesión mediante un refresh token invalidado', async () => {
      // Caso 4A: La persistencia falló pero el cleanup eliminó la credencial obsoleta
      const { session, storage } = setup();
      await login(session, true);
      const rotated = 'b'.repeat(64);
      storage.set.mockRejectedValueOnce(new Error('SecureStore write failed'));
      jest.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({
          ...AUTH_SESSION,
          accessToken: 'rotated-access',
          refreshToken: rotated,
        }),
      );
      await session.refresh();

      // Simular reinicio de proceso
      const restartedA = createAuthSession(storage);
      await restartedA.restore();
      expect(restartedA.getSnapshot().status).toBe('guest');
      expect(restartedA.getAccessToken()).toBeNull();

      // Caso 4B: SecureStore falló tanto en escritura como en eliminación (token anterior quedó atrapado en disco)
      const { session: sessionB, storage: storageB, saved: savedB } = setup();
      await login(sessionB, true);
      const initialToken = savedB();
      storageB.set.mockRejectedValueOnce(new Error('SecureStore set failed'));
      storageB.remove.mockRejectedValueOnce(new Error('SecureStore remove failed'));
      jest.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({
          ...AUTH_SESSION,
          accessToken: 'rotated-access-b',
          refreshToken: 'b'.repeat(64),
        }),
      );
      await sessionB.refresh();

      // El token anterior aún está en el mock porque remove falló
      expect(savedB()).toBe(initialToken);

      // Simular reinicio: restore intenta usar el token obsoleto, pero el backend lo rechaza
      const restartedB = createAuthSession(storageB);
      jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'Token invalidado' }, 401));
      await restartedB.restore();
      expect(restartedB.getSnapshot().status).toBe('expired');
      expect(restartedB.getAccessToken()).toBeNull();
    });

    it('TEST-05. Logout tras renovación con fallo de persistencia: limpia el estado local y revoca la credencial vigente', async () => {
      const { session, storage, saved } = setup();
      await login(session, true);
      const rotated = 'b'.repeat(64);
      storage.set.mockRejectedValueOnce(new Error('SecureStore write failed'));
      jest.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({
          ...AUTH_SESSION,
          accessToken: 'rotated-access',
          refreshToken: rotated,
        }),
      );
      await session.refresh();

      jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'Sesión cerrada' }));
      await session.logout();

      expect(session.getSnapshot().status).toBe('guest');
      expect(session.getAccessToken()).toBeNull();
      expect(saved()).toBeNull();

      // Verificar que se revocó el token vigente en el backend
      const logoutCall = jest
        .mocked(fetch)
        .mock.calls.find(([url]) => String(url).endsWith('/auth/mobile/logout'));
      expect(logoutCall).toBeDefined();
      expect(JSON.parse(String(logoutCall![1]?.body))).toEqual({ refreshToken: rotated });

      // Verificar que restaurar no reactiva la sesión
      const restored = createAuthSession(storage);
      await restored.restore();
      expect(restored.getSnapshot().status).toBe('guest');
    });

    it('TEST-06. Renovaciones simultáneas: coordina múltiples 401 en una única llamada de refresh', async () => {
      const { session } = setup();
      await login(session);
      const rotation = deferred<Response>();
      jest.mocked(fetch).mockImplementation(async (url, options) => {
        if (String(url).endsWith('/auth/mobile/refresh')) return rotation.promise;
        return new Headers(options?.headers).get('Authorization') === 'Bearer concurrent-rotated'
          ? jsonResponse({ user: AUTH_USER })
          : jsonResponse({}, 401);
      });

      const first = httpClient.request('/users/me', { authenticated: true });
      const second = httpClient.request('/users/me', { authenticated: true });
      const third = httpClient.request('/users/me', { authenticated: true });

      await new Promise((resolve) => setTimeout(resolve, 0));
      rotation.resolve(
        jsonResponse({
          ...AUTH_SESSION,
          accessToken: 'concurrent-rotated',
          refreshToken: 'b'.repeat(64),
        }),
      );

      const results = await Promise.all([first, second, third]);
      expect(results).toEqual([{ user: AUTH_USER }, { user: AUTH_USER }, { user: AUTH_USER }]);

      const refreshCalls = jest
        .mocked(fetch)
        .mock.calls.filter(([url]) => String(url).endsWith('/auth/mobile/refresh'));
      expect(refreshCalls).toHaveLength(1);
    });

    it('TEST-07. Cambio de cuenta: una renovación de cuenta A no sobrescribe las credenciales de cuenta B', async () => {
      const { session } = setup();
      await login(session);
      const refreshA = deferred<Response>();
      jest.mocked(fetch).mockReturnValueOnce(refreshA.promise);

      // Iniciar refresh para cuenta A
      const pendingRefreshA = session.refresh();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // El usuario cierra sesión
      await session.clear();

      // El usuario inicia sesión como cuenta B mientras el refresh de A aún estaba en curso
      const USER_B = { ...AUTH_USER, id: 99, correo: 'otro@cemydi.test' };
      jest.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({
          ...AUTH_SESSION,
          accessToken: 'token-user-b',
          user: USER_B,
        }),
      );
      const pendingLoginB = session.login('otro@cemydi.test', 'Password123!', true);

      // La respuesta tardía del refresh de cuenta A llega mientras se procesa el login de cuenta B
      refreshA.resolve(
        jsonResponse({
          ...AUTH_SESSION,
          accessToken: 'token-late-user-a',
          refreshToken: 'a'.repeat(64),
          user: AUTH_USER,
        }),
      );

      await pendingRefreshA;
      await pendingLoginB;

      // La sesión actual debe pertenecer exclusivamente a la cuenta B
      expect(session.getSnapshot().user?.id).toBe(USER_B.id);
      expect(session.getSnapshot().user?.correo).toBe(USER_B.correo);
      expect(session.getAccessToken()).toBe('token-user-b');
      expect(session.getSnapshot().status).toBe('authenticated');
    });

    it('TEST-08. Error de conectividad: conserva la credencial segura ante fallo de red sin confundirlos con revocación', async () => {
      const { session, storage, saved } = setup(AUTH_SESSION.refreshToken);
      jest.mocked(fetch).mockRejectedValueOnce(new TypeError('Network request failed'));

      await session.restore();

      expect(session.getSnapshot().status).toBe('error');
      expect(session.getAccessToken()).toBeNull();
      // La credencial se conserva en almacenamiento seguro
      expect(saved()).toBe(AUTH_SESSION.refreshToken);
      expect(storage.remove).not.toHaveBeenCalled();

      // Reintento tras restablecer la conectividad
      jest.mocked(fetch).mockResolvedValueOnce(jsonResponse(AUTH_SESSION));
      await session.restore();
      expect(session.getSnapshot().status).toBe('authenticated');
      expect(session.getAccessToken()).toBe(AUTH_SESSION.accessToken);
    });

    it('TEST-09. Token rechazado: si el servidor rechaza el refresh, la sesión expira y no se mantiene falsamente autenticada', async () => {
      const { session, saved } = setup(AUTH_SESSION.refreshToken);
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(jsonResponse({ message: 'Refresh token revocado o expirado' }, 401));

      await session.restore();

      expect(session.getSnapshot().status).toBe('expired');
      expect(session.getSnapshot().user).toBeNull();
      expect(session.getAccessToken()).toBeNull();
      expect(saved()).toBeNull();
    });

    it('TEST-10. Fallo al eliminar una credencial: informa error si SecureStore no elimina ni sobrescribe, sin ocultar la persistencia residual', async () => {
      const { session, storage } = setup();
      await login(session);
      storage.remove.mockRejectedValueOnce(new Error('SecureStore remove failed'));
      storage.set.mockRejectedValueOnce(new Error('SecureStore set failed'));

      await expect(session.logout()).rejects.toThrow('Reintenta cerrar sesión');
      expect(session.getSnapshot().status).toBe('error');
      expect(session.getSnapshot().error).toBeInstanceOf(Error);

      // Reintentar cuando SecureStore responde adecuadamente
      jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'Sesión cerrada' }));
      await expect(session.logout()).resolves.toEqual({ remoteStatus: 'revoked' });
      expect(session.getSnapshot().status).toBe('guest');
    });
  });
});
