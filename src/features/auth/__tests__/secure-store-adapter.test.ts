import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import { authSession } from '../services/auth-session';
import { AUTH_ACCOUNT, AUTH_SESSION, jsonResponse } from '../../../../tests/support/auth-api-mock';

const key = 'cemydi.mobile.refresh';
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

beforeEach(async () => {
  jest.spyOn(Device, 'isRootedExperimentalAsync').mockResolvedValue(false);
  await authSession.clear();
  jest.clearAllMocks();
});

afterEach(async () => {
  await authSession.clear();
});

describe('Adaptador real de sesión hacia SecureStore (módulo nativo simulado)', () => {
  it('persiste exclusivamente refresh con la política Keychain y lo retira al cerrar sesión', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse(AUTH_SESSION));
    await authSession.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, true);

    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(key, AUTH_SESSION.refreshToken, options);
    expect(authSession.getAccessToken()).toBe(AUTH_SESSION.accessToken);

    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'Sesión cerrada' }));
    await authSession.logout();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(key, options);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(key, options);
    expect(await SecureStore.getItemAsync(key, options)).toBeNull();
    expect(authSession.getAccessToken()).toBeNull();
    expect(authSession.getSnapshot().status).toBe('guest');
  });

  it('sin mantener sesión no escribe tokens en SecureStore', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse(AUTH_SESSION));
    await authSession.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, false);

    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(key, options);
    expect(authSession.getAccessToken()).toBe(AUTH_SESSION.accessToken);
  });
});
