import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationPreferencesScreen } from '../NotificationPreferencesScreen';
import { notificationService } from '../notification-service';
const mockShowError = jest.fn();
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 7, rol: 'CLIENT' },
    status: 'authenticated',
    getSessionVersion: () => 1,
    getSession: () => ({ user: { id: 7 } }),
  }),
}));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: true }) }));
jest.mock('@/hooks/useToast', () => ({ useToast: () => ({ error: mockShowError }) }));
jest.mock('expo-router', () => ({ useFocusEffect: () => undefined }));
jest.mock('../native-push', () => ({ registerNativePush: jest.fn() }));
jest.mock('@/features/profile/components/ProfileLayout', () => ({
  ProfileLayout: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('../notification-service', () => ({
  notificationService: { preferences: jest.fn(), savePreferences: jest.fn() },
}));
const initial = { pushEnabled: true, system: true, offers: true, rentals: true };
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  jest.mocked(notificationService.preferences).mockResolvedValue({ preferences: { ...initial } });
  jest.mocked(notificationService.savePreferences).mockImplementation(async (preferences) => {
    jest.mocked(notificationService.preferences).mockResolvedValue({ preferences });
    return { preferences };
  });
});
afterEach(() => client.clear());
it('saves a switch immediately without a save button', async () => {
  await render(<NotificationPreferencesScreen />, { wrapper });
  const offers = await screen.findByRole('switch', { name: 'Ofertas' });
  await fireEvent.press(offers);
  await waitFor(() =>
    expect(notificationService.savePreferences).toHaveBeenCalledWith({ ...initial, offers: false }),
  );
  await waitFor(() =>
    expect(screen.getByRole('switch', { name: 'Ofertas' })).toHaveProp(
      'accessibilityState',
      expect.objectContaining({
        checked: false,
      }),
    ),
  );
  expect(screen.queryByRole('button', { name: 'Guardar preferencias' })).toBeNull();
  expect(screen.queryByText('Preferencias sincronizadas')).toBeNull();
});
it('restores the previous switch value and shows a brief error after failure', async () => {
  jest.mocked(notificationService.savePreferences).mockRejectedValueOnce(new Error('Offline'));
  await render(<NotificationPreferencesScreen />, { wrapper });
  await fireEvent.press(await screen.findByRole('switch', { name: 'Ofertas' }));
  await waitFor(() => expect(mockShowError).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('switch', { name: 'Ofertas' })).toHaveProp(
    'accessibilityState',
    expect.objectContaining({
      checked: true,
    }),
  );
});
