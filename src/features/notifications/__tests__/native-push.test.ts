import * as notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { registerNativePush, releaseNativePush, requestNativePermissionOnce } from '../native-push';
import { notificationService } from '../notification-service';
import { explainPermission } from '@/services/permission-rationale';
import { PUSH_REGISTRATION_KEY } from '../push-registration';
jest.mock('@/services/permission-rationale', () => ({
  explainPermission: jest.fn(() => Promise.resolve(true)),
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    executionEnvironment: 'standalone',
    easConfig: { projectId: '11111111-1111-1111-1111-111111111111' },
  },
  ExecutionEnvironment: { StoreClient: 'store' },
}));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
}));
jest.mock('../notification-service', () => ({
  notificationService: { register: jest.fn(), unregister: jest.fn() },
}));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  dismissAllNotificationsAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  getExpoPushTokenAsync: jest.fn(),
}));
const denied = { granted: false, status: 'denied', canAskAgain: true, expires: 'never' } as const;
const undecided = { ...denied, status: 'undetermined' } as const;
const granted = { ...denied, granted: true, status: 'granted' } as const;
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(explainPermission).mockResolvedValue(true);
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  jest.mocked(SecureStore.setItemAsync).mockResolvedValue();
  jest.mocked(SecureStore.deleteItemAsync).mockResolvedValue();
  jest.mocked(notifications.setNotificationChannelAsync).mockResolvedValue(null);
  jest
    .mocked(notifications.getPermissionsAsync)
    .mockResolvedValue(denied as notifications.NotificationPermissionsStatus);
  jest
    .mocked(notifications.getExpoPushTokenAsync)
    .mockResolvedValue({ type: 'expo', data: 'ExponentPushToken[fixture]' });
  jest.mocked(notifications.dismissAllNotificationsAsync).mockResolvedValue(undefined);
  jest.mocked(notificationService.unregister).mockResolvedValue({ message: 'ok' });
});
it('persists registration before sending it and removes it after confirmed server logout', async () => {
  jest
    .mocked(notifications.getPermissionsAsync)
    .mockResolvedValue(granted as notifications.NotificationPermissionsStatus);
  await registerNativePush(() => true, true, 7);
  expect(notificationService.register).toHaveBeenCalledWith('ExponentPushToken[fixture]');
  const record = JSON.stringify({ userId: 7, endpoint: 'ExponentPushToken[fixture]' });
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(PUSH_REGISTRATION_KEY, record, {
    keychainAccessible: 'device-only',
  });
  expect(jest.mocked(SecureStore.setItemAsync).mock.invocationCallOrder[0]).toBeLessThan(
    jest.mocked(notificationService.register).mock.invocationCallOrder[0]!,
  );
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(record);
  await expect(
    releaseNativePush(7, Promise.resolve({ remoteStatus: 'revoked' }), () => true),
  ).resolves.toBe('cleared');
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PUSH_REGISTRATION_KEY, {
    keychainAccessible: 'device-only',
  });
  expect(notificationService.unregister).not.toHaveBeenCalled();
  expect(notifications.dismissAllNotificationsAsync).toHaveBeenCalledTimes(1);
});
it('reads a registration left by a previous app process when logging out', async () => {
  jest
    .mocked(SecureStore.getItemAsync)
    .mockResolvedValue(JSON.stringify({ userId: 7, endpoint: 'ExpoPushToken[previousProcess]' }));
  await expect(
    releaseNativePush(7, Promise.resolve({ remoteStatus: 'revoked' }), () => true),
  ).resolves.toBe('cleared');
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
});
it.each(['pending', 'failed'] as const)(
  'retains encrypted metadata while remote logout is %s',
  async (remoteStatus) => {
    await expect(releaseNativePush(7, Promise.resolve({ remoteStatus }), () => true)).resolves.toBe(
      'pending',
    );
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  },
);
it('cannot remove the registration of a different account', async () => {
  jest
    .mocked(SecureStore.getItemAsync)
    .mockResolvedValue(JSON.stringify({ userId: 8, endpoint: 'ExpoPushToken[other]' }));
  await expect(
    releaseNativePush(7, Promise.resolve({ remoteStatus: 'revoked' }), () => true),
  ).resolves.toBe('pending');
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});
it('waits for remote revocation before deleting the persisted registration', async () => {
  jest
    .mocked(SecureStore.getItemAsync)
    .mockResolvedValue(JSON.stringify({ userId: 7, endpoint: 'ExpoPushToken[persisted]' }));
  let finishRemote!: (result: { remoteStatus: 'revoked' }) => void;
  const remote = new Promise<{ remoteStatus: 'revoked' }>((resolve) => {
    finishRemote = resolve;
  });
  const cleanup = releaseNativePush(7, remote, () => true);
  await Promise.resolve();
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  finishRemote({ remoteStatus: 'revoked' });
  await expect(cleanup).resolves.toBe('cleared');
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
});
it('preserves a new login even for the same account while logout is completing', async () => {
  let current = true;
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async () => {
    current = false;
    return JSON.stringify({ userId: 7, endpoint: 'ExpoPushToken[newSession]' });
  });
  await expect(
    releaseNativePush(7, Promise.resolve({ remoteStatus: 'revoked' }), () => current),
  ).resolves.toBe('pending');
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});
it('does not register when secure storage fails', async () => {
  jest
    .mocked(notifications.getPermissionsAsync)
    .mockResolvedValue(granted as notifications.NotificationPermissionsStatus);
  jest.mocked(SecureStore.setItemAsync).mockRejectedValue(new Error('storage unavailable'));
  await expect(registerNativePush(() => true, true, 7)).rejects.toThrow();
  expect(notificationService.register).not.toHaveBeenCalled();
});
it('stops an in-flight registration at logout', async () => {
  jest
    .mocked(notifications.getPermissionsAsync)
    .mockResolvedValue(granted as notifications.NotificationPermissionsStatus);
  let resolveToken!: (token: { type: 'expo'; data: string }) => void;
  jest.mocked(notifications.getExpoPushTokenAsync).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveToken = resolve;
      }),
  );
  const registration = registerNativePush(() => true, true, 7);
  // Wait until native token acquisition is in flight.
  for (let step = 0; step < 10 && !resolveToken; step += 1) await Promise.resolve();
  const result = expect(registration).rejects.toThrow('La sesión cambió');
  await releaseNativePush(7, Promise.resolve({ remoteStatus: 'revoked' }), () => true);
  resolveToken({ type: 'expo', data: 'ExpoPushToken[late]' });
  await result;
  expect(notificationService.register).not.toHaveBeenCalled();
});
it('reports local cleanup errors instead of confirming deletion', async () => {
  jest.mocked(SecureStore.getItemAsync).mockRejectedValue(new Error('unavailable'));
  await expect(
    releaseNativePush(7, Promise.resolve({ remoteStatus: 'revoked' }), () => true),
  ).resolves.toBe('failed');
});
it('does not prompt again after the OS decision', async () => {
  expect((await requestNativePermissionOnce(notifications)).status).toBe('denied');
  expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});
it('honors a persisted previous attempt when the OS still reports undetermined', async () => {
  jest
    .mocked(notifications.getPermissionsAsync)
    .mockResolvedValue(undecided as notifications.NotificationPermissionsStatus);
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('1');
  expect((await requestNativePermissionOnce(notifications)).status).toBe('undetermined');
  expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});
it('does not request OS permission or persist an attempt after cancelling the explanation', async () => {
  jest.mocked(explainPermission).mockResolvedValue(false);
  jest
    .mocked(notifications.getPermissionsAsync)
    .mockResolvedValue(undecided as notifications.NotificationPermissionsStatus);
  await requestNativePermissionOnce(notifications);
  expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});
it('does not request OS permission if the session changes during the explanation', async () => {
  jest
    .mocked(notifications.getPermissionsAsync)
    .mockResolvedValue(undecided as notifications.NotificationPermissionsStatus);
  await requestNativePermissionOnce(notifications, () => false);
  expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});
it('shares one OS prompt between simultaneous access requests', async () => {
  jest
    .mocked(notifications.getPermissionsAsync)
    .mockResolvedValue(undecided as notifications.NotificationPermissionsStatus);
  jest
    .mocked(notifications.requestPermissionsAsync)
    .mockResolvedValue(granted as notifications.NotificationPermissionsStatus);
  await Promise.all([
    requestNativePermissionOnce(notifications),
    requestNativePermissionOnce(notifications),
  ]);
  expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    'cemydi-notification-permission-requested',
    '1',
  );
});
