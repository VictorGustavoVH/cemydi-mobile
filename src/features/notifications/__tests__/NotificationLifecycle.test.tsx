import { useEffect } from 'react';
import { act, waitFor } from '@testing-library/react-native';
import type { Notification, NotificationHandler, NotificationResponse } from 'expo-notifications';
import { render } from '../../../../tests/support/render-with-toast';
import { AUTH_ACCOUNT, installAuthApiMock } from '../../../../tests/support/auth-api-mock';
import { useAuth } from '@/providers/auth-provider';
import { NotificationLifecycle } from '../NotificationLifecycle';

const mockRouter = { push: jest.fn() };
const mockRemove = jest.fn();
const mockNative = {
  setNotificationHandler: jest.fn((_handler: NotificationHandler | null) => undefined),
  addNotificationResponseReceivedListener: jest.fn(
    (_listener: (response: NotificationResponse) => void) => ({ remove: mockRemove }),
  ),
  addNotificationReceivedListener: jest.fn((_listener: (notification: Notification) => void) => ({
    remove: mockRemove,
  })),
  addPushTokenListener: jest.fn(() => ({ remove: mockRemove })),
  getLastNotificationResponseAsync: jest.fn(async (): Promise<NotificationResponse | null> => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
};
const mockRegister = jest.fn(async (..._args: unknown[]) => undefined);
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('../native-push', () => ({
  ...jest.requireActual('../native-push'),
  loadNativeNotifications: async () => mockNative,
  registerNativePush: (...args: unknown[]) => mockRegister(...args),
}));
let auth: ReturnType<typeof useAuth>;
function Harness({ login = true }: { login?: boolean }) {
  const currentAuth = useAuth();
  const { service } = currentAuth;
  useEffect(() => {
    auth = currentAuth;
  }, [currentAuth]);
  useEffect(() => {
    if (login) void service.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, false);
  }, [login, service]);
  return <NotificationLifecycle />;
}
function response(userId = 1, notificationId = 'notice-1'): NotificationResponse {
  return {
    actionIdentifier: 'default',
    notification: {
      date: 1,
      request: {
        identifier: `request-${notificationId}`,
        trigger: null,
        content: {
          title: 'Aviso',
          subtitle: null,
          body: 'Prueba',
          sound: null,
          categoryIdentifier: null,
          data: { userId, notificationId },
          launchImageName: null,
          badge: null,
          attachments: [],
          threadIdentifier: null,
        },
      },
    },
  };
}
beforeEach(() => {
  jest.clearAllMocks();
  installAuthApiMock();
});
async function ready() {
  await waitFor(() => expect(auth.status).toBe('authenticated'));
  await waitFor(() => expect(mockRegister).toHaveBeenCalled());
  return mockNative.addNotificationResponseReceivedListener.mock.calls.at(-1)![0];
}
it('abre una sola vez el destino validado de la cuenta actual', async () => {
  await render(<Harness />);
  const open = await ready();
  await act(async () => {
    open(response());
    open(response());
  });
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: '/perfil/notificaciones/[id]',
    params: { id: 'notice-1' },
  });
  expect(mockNative.clearLastNotificationResponseAsync).toHaveBeenCalled();
});
it('ignora avisos de otra cuenta, destinos externos y listeners de una sesión cerrada', async () => {
  await render(<Harness />);
  const open = await ready();
  await act(async () => {
    open(response(2));
    open(response(1, 'https://externo.invalid'));
  });
  expect(mockRouter.push).not.toHaveBeenCalled();
  await act(async () => {
    await auth.logout();
  });
  await act(async () => {
    open(response());
  });
  expect(mockRouter.push).not.toHaveBeenCalled();
});
it('conserva un destino interno durante login y elimina las suscripciones al desmontar', async () => {
  const view = await render(<Harness login={false} />);
  await waitFor(() =>
    expect(mockNative.addNotificationResponseReceivedListener).toHaveBeenCalled(),
  );
  const open = mockNative.addNotificationResponseReceivedListener.mock.calls.at(-1)![0];
  await act(async () => {
    open(response());
  });
  expect(auth.authDestination).toBe('/perfil/notificaciones/notice-1');
  expect(mockRouter.push).toHaveBeenCalledWith('/login');
  await view.unmount();
  expect(mockRemove).toHaveBeenCalledTimes(3);
  expect(mockNative.setNotificationHandler).toHaveBeenLastCalledWith(null);
});
it('presenta avisos en primer plano solo para la cuenta comprobada', async () => {
  await render(<Harness />);
  await ready();
  const handler = mockNative.setNotificationHandler.mock.calls.at(-1)![0];
  expect(handler).not.toBeNull();
  expect(await handler?.handleNotification(response().notification)).toMatchObject({
    shouldShowBanner: true,
  });
  expect(await handler?.handleNotification(response(2).notification)).toMatchObject({
    shouldShowBanner: false,
  });
});
