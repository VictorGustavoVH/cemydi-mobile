import * as notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { requestNativePermissionOnce } from '../native-push';
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    executionEnvironment: 'standalone',
    easConfig: { projectId: '11111111-1111-1111-1111-111111111111' },
  },
  ExecutionEnvironment: { StoreClient: 'store' },
}));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }));
jest.mock('../notification-service', () => ({ notificationService: { register: jest.fn() } }));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  getExpoPushTokenAsync: jest.fn(),
}));
const denied = { granted: false, status: 'denied', canAskAgain: true, expires: 'never' } as const;
const undecided = { ...denied, status: 'undetermined' } as const;
const granted = { ...denied, granted: true, status: 'granted' } as const;
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  jest.mocked(SecureStore.setItemAsync).mockResolvedValue();
  jest.mocked(notifications.setNotificationChannelAsync).mockResolvedValue(null);
  jest
    .mocked(notifications.getPermissionsAsync)
    .mockResolvedValue(denied as notifications.NotificationPermissionsStatus);
  jest
    .mocked(notifications.getExpoPushTokenAsync)
    .mockResolvedValue({ type: 'expo', data: 'ExponentPushToken[fixture]' });
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
