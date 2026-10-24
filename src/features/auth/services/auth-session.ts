import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { httpClient } from '@/services/http/client';
import { ApiError, isApiError, UserFacingError } from '@/services/http/api-error';
import {
  currentUserSchema,
  mobileSessionSchema,
  authMessageSchema,
  type AuthUser,
} from '../schemas/auth-api-schemas';
import { authPost } from './auth-api';

const STORAGE_KEY = 'cemydi.mobile.refresh';
const LOGGED_OUT_MARKER = 'cemydi.mobile.logged-out';
const STORAGE_OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
type SessionState = {
  user: AuthUser | null;
  status: 'loading' | 'guest' | 'authenticated' | 'expired' | 'error';
  error: unknown;
};
type CredentialStorage = {
  get: () => Promise<string | null>;
  set: (token: string) => Promise<void>;
  remove: () => Promise<void>;
};

export class LogoutStorageError extends UserFacingError {
  constructor() {
    super(
      'No pudimos confirmar el cierre local. Reintenta cerrar sesión antes de salir de la app.',
    );
  }
}

export class CompromisedDeviceError extends UserFacingError {
  constructor() {
    super(
      'Este dispositivo muestra señales de root o jailbreak. Por seguridad, no podemos abrir una sesión.',
    );
  }
}

export function createAuthSession(
  storage: CredentialStorage,
  isCompromisedDevice: () => Promise<boolean> = async () => false,
) {
  let state: SessionState = { user: null, status: 'loading', error: null };
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  let persistent = false;
  let revision = 0;
  let profileRevision = 0;
  let refreshTask: Promise<void> | null = null;
  let logoutTask: Promise<{ remoteStatus: 'revoked' | 'pending' | 'failed' }> | null = null;
  let closingRotation: Promise<void> | null = null;
  let rotatedDuringLogout: string | null = null;
  let explicitLogout = false;
  let storageTask = Promise.resolve();
  const listeners = new Set<() => void>();
  const publish = (next: SessionState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  const writeStorage = (action: () => Promise<void>) => {
    const task = storageTask.catch(() => undefined).then(action);
    storageTask = task;
    return task;
  };
  async function requireTrustedDevice() {
    if (await isCompromisedDevice()) {
      throw new CompromisedDeviceError();
    }
  }
  async function clear(reason?: 'expired') {
    explicitLogout = false;
    revision += 1;
    accessToken = null;
    refreshToken = null;
    persistent = false;
    publish({ user: null, status: reason ?? 'guest', error: null });
    await writeStorage(storage.remove);
  }
  async function refresh() {
    if (logoutTask) throw new ApiError('El cierre de sesión está en curso.', { kind: 'abort' });
    if (refreshTask) return refreshTask;
    const expected = revision;
    const expectedProfile = profileRevision;
    refreshTask = (async () => {
      try {
        await requireTrustedDevice();
        const fromMemory = refreshToken;
        const token = fromMemory ?? (await storage.get());
        if (expected !== revision) return;
        if (!token || token === LOGGED_OUT_MARKER) {
          publish({ user: null, status: 'guest', error: null });
          return;
        }
        if (!fromMemory) persistent = true;
        const result = await authPost(
          '/auth/mobile/refresh',
          { refreshToken: token },
          mobileSessionSchema,
          false,
        );
        if (expected !== revision) {
          if (closingRotation) rotatedDuringLogout = result.refreshToken;
          return;
        }
        refreshToken = result.refreshToken;
        if (persistent) await writeStorage(() => storage.set(result.refreshToken));
        if (expected !== revision) return;
        accessToken = result.accessToken;
        refreshToken = result.refreshToken;
        const user =
          expectedProfile !== profileRevision && state.user?.id === result.user.id
            ? state.user
            : result.user;
        publish({ user, status: 'authenticated', error: null });
      } catch (error) {
        if (expected !== revision) return;
        if (error instanceof CompromisedDeviceError) {
          await clear();
          publish({ user: null, status: 'error', error });
          throw error;
        }
        // An invalid refresh ends the session; connectivity failures retain the secure credential.
        if (
          isApiError(error) &&
          (error.status === 400 || error.status === 401 || error.status === 403)
        ) {
          await clear('expired');
        } else {
          accessToken = null;
          publish({ user: null, status: 'error', error });
        }
        throw error;
      }
    })().finally(() => {
      refreshTask = null;
    });
    return refreshTask;
  }
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
    getAccessToken: () => accessToken,
    getVersion: () => revision,
    consumeExplicitLogout: () => {
      const value = explicitLogout;
      explicitLogout = false;
      return value;
    },
    updateUser(user: AuthUser, expectedVersion: number) {
      if (
        revision !== expectedVersion ||
        state.status !== 'authenticated' ||
        state.user?.id !== user.id
      )
        throw new UserFacingError('La sesión cambió. Vuelve a abrir tu perfil.');
      profileRevision += 1;
      publish({ user, status: 'authenticated', error: null });
    },
    clear,
    expire: () => clear('expired'),
    refresh,
    async restore() {
      if (
        state.status === 'authenticated' ||
        state.status === 'guest' ||
        state.status === 'expired'
      )
        return;
      try {
        await refresh();
      } catch {
        /* State exposes the error and allows retry. */
      }
    },
    async login(correo: string, password: string, remember: boolean) {
      await requireTrustedDevice();
      if (logoutTask) await logoutTask;
      await refreshTask?.catch(() => undefined);
      const expected = ++revision;
      const result = await authPost(
        '/auth/mobile/login',
        { correo, password },
        mobileSessionSchema,
      );
      await acceptLogin(result, remember, expected);
    },
    async loginWithGoogle(idToken: string, remember: boolean) {
      await requireTrustedDevice();
      if (logoutTask) await logoutTask;
      await refreshTask?.catch(() => undefined);
      const expected = ++revision;
      const result = await authPost('/auth/mobile/google', { idToken }, mobileSessionSchema);
      await acceptLogin(result, remember, expected);
    },
    async revalidate() {
      if (state.status === 'loading') return;
      await requireTrustedDevice().catch(async (error) => {
        await this.logout();
        publish({ user: null, status: 'error', error });
        throw error;
      });
      if (!accessToken) {
        if (state.status === 'error') await refresh();
        return;
      }
      const expected = revision;
      const expectedProfile = profileRevision;
      const data = await httpClient.request('/users/me', { authenticated: true });
      const result = currentUserSchema.safeParse(data);
      if (!result.success) throw new ApiError('Perfil inválido.', { kind: 'parse' });
      if (expected !== revision || expectedProfile !== profileRevision) return;
      if (!result.data.user) await clear();
      else publish({ user: result.data.user, status: 'authenticated', error: null });
    },
    async logout() {
      if (logoutTask) return logoutTask;
      const token = refreshToken;
      const rotation = refreshTask;
      closingRotation = rotation;
      explicitLogout = true;
      revision += 1;
      accessToken = null;
      refreshToken = null;
      persistent = false;
      publish({ user: null, status: 'guest', error: null });
      logoutTask = (async () => {
        let storedToken: string | null = null;
        try {
          storedToken = await storage.get();
        } catch {
          // A failed read cannot prevent an attempted removal.
        }
        try {
          await writeStorage(storage.remove);
          if (await storage.get()) {
            throw new Error('La credencial sigue almacenada.');
          }
        } catch (error) {
          try {
            await writeStorage(() => storage.set(LOGGED_OUT_MARKER));
            if ((await storage.get()) !== LOGGED_OUT_MARKER) throw error;
          } catch {
            const failure = new LogoutStorageError();
            publish({ user: null, status: 'error', error: failure });
            throw failure;
          }
        }
        const revoke = (async () => {
          await rotation?.catch(() => undefined);
          closingRotation = null;
          const tokens = new Set([token, storedToken, rotatedDuringLogout].filter(Boolean));
          rotatedDuringLogout = null;
          let failed = false;
          for (const value of tokens) {
            if (value === LOGGED_OUT_MARKER) continue;
            try {
              await authPost(
                '/auth/mobile/logout',
                { refreshToken: value },
                authMessageSchema,
                false,
              );
            } catch {
              failed = true;
            }
          }
          return failed ? ('failed' as const) : ('revoked' as const);
        })();
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const status = await Promise.race([
          revoke,
          new Promise<'pending'>((resolve) => {
            timeout = setTimeout(() => resolve('pending'), 1_500);
          }),
        ]);
        if (timeout) clearTimeout(timeout);
        return { remoteStatus: status };
      })().finally(() => {
        logoutTask = null;
      });
      return logoutTask;
    },
  };

  async function acceptLogin(
    result: import('../schemas/auth-api-schemas').MobileSession,
    remember: boolean,
    expected: number,
  ) {
    const discardCancelledLogin = async () => {
      await authPost(
        '/auth/mobile/logout',
        { refreshToken: result.refreshToken },
        authMessageSchema,
      ).catch(() => undefined);
      throw new UserFacingError('El inicio de sesión fue cancelado.');
    };
    if (expected !== revision) return discardCancelledLogin();
    try {
      await writeStorage(() => (remember ? storage.set(result.refreshToken) : storage.remove()));
    } catch (error) {
      await authPost(
        '/auth/mobile/logout',
        { refreshToken: result.refreshToken },
        authMessageSchema,
      ).catch(() => undefined);
      throw error;
    }
    if (expected !== revision) return discardCancelledLogin();
    persistent = remember;
    explicitLogout = false;
    refreshToken = result.refreshToken;
    accessToken = result.accessToken;
    publish({ user: result.user, status: 'authenticated', error: null });
  }
}

export const authSession = createAuthSession(
  {
    get: () => SecureStore.getItemAsync(STORAGE_KEY, STORAGE_OPTIONS),
    set: (token) => SecureStore.setItemAsync(STORAGE_KEY, token, STORAGE_OPTIONS),
    remove: () => SecureStore.deleteItemAsync(STORAGE_KEY, STORAGE_OPTIONS),
  },
  async () => {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return false;
    return Device.isRootedExperimentalAsync();
  },
);
