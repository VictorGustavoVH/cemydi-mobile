import { useEffect } from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { render } from '../../../../tests/support/render-with-toast';
import { AUTH_ACCOUNT, installAuthApiMock } from '../../../../tests/support/auth-api-mock';
import { installNetworkMock } from '../../../../tests/support/network-mock';
import { useAuth } from '@/providers/auth-provider';
import { HomeNotificationBell } from '../HomeNotificationBell';
import { notificationService } from '../notification-service';

const mockPermission = jest.fn();
jest.mock('../useNotificationPermissionAccess', () => ({
  useNotificationPermissionAccess: () => mockPermission,
}));
jest.mock('expo-router', () => ({ useFocusEffect: () => undefined }));
let client: QueryClient;
function Harness({ open }: { open: () => void }) {
  const { service } = useAuth();
  const currentClient = useQueryClient();
  useEffect(() => {
    client = currentClient;
  }, [currentClient]);
  useEffect(() => {
    void service.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, false);
  }, [service]);
  return <HomeNotificationBell onPress={open} />;
}
it('comparte el contador de la cuenta y mantiene disponible la navegación al pedir permiso', async () => {
  installAuthApiMock();
  installNetworkMock();
  jest
    .spyOn(notificationService, 'inbox')
    .mockResolvedValue({ items: [], unreadCount: 5, total: 5, page: 1, pageSize: 20 });
  const open = jest.fn();
  await render(<Harness open={open} />);
  await fireEvent.press(await screen.findByLabelText('Notificaciones, 5 sin leer'));
  expect(mockPermission).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledTimes(1);
  await act(async () => {
    client.setQueryData(['notifications', 1, 'inbox', 1, undefined], {
      items: [],
      unreadCount: 0,
      total: 0,
      page: 1,
      pageSize: 20,
    });
  });
  expect(await screen.findByLabelText('Notificaciones')).toBeTruthy();
  expect(screen.queryByText('5')).toBeNull();
});
