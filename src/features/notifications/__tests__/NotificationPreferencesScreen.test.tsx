import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationPreferencesScreen } from '../NotificationPreferencesScreen';
import { notificationService } from '../notification-service';

const mockShowError = jest.fn();
const mockAuth = {
  user: { id: 7, rol: 'CLIENT' } as { id: number; rol: string } | null,
  status: 'authenticated',
  getSessionVersion: () => 1,
  getSession: () => ({ user: mockAuth.user }),
};

jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => mockAuth,
}));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: true }) }));
jest.mock('@/hooks/useToast', () => ({ useToast: () => ({ error: mockShowError }) }));
jest.mock('expo-router', () => ({ useFocusEffect: () => undefined }));
jest.mock('../native-push', () => ({ registerNativePush: jest.fn() }));
jest.mock('@/components/account/AccountLayout', () => ({
  AccountLayout: ({ children }: { children: ReactNode }) => children,
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
  mockAuth.status = 'authenticated';
  mockAuth.user = { id: 7, rol: 'CLIENT' };
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  jest.mocked(notificationService.preferences).mockResolvedValue({ preferences: { ...initial } });
  jest.mocked(notificationService.savePreferences).mockImplementation(async (preferences) => {
    jest.mocked(notificationService.preferences).mockResolvedValue({ preferences });
    return { preferences };
  });
});

afterEach(() => client.clear());

describe('NotificationPreferencesScreen — NOV-03: Preferencias de notificaciones y oposición promocional', () => {
  it('TEST-01. Preferencias independientes: con pushEnabled=false el usuario puede modificar offers', async () => {
    const initialDisabledPush = { pushEnabled: false, system: true, offers: true, rentals: true };
    jest
      .mocked(notificationService.preferences)
      .mockResolvedValueOnce({ preferences: { ...initialDisabledPush } });

    await render(<NotificationPreferencesScreen />, { wrapper });
    const offersSwitch = await screen.findByRole('switch', { name: 'Ofertas' });

    expect(offersSwitch).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ disabled: false, checked: true }),
    );

    await fireEvent.press(offersSwitch);

    await waitFor(() =>
      expect(notificationService.savePreferences).toHaveBeenCalledWith({
        ...initialDisabledPush,
        offers: false,
      }),
    );

    expect(screen.getByRole('switch', { name: 'Ofertas' })).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ checked: false }),
    );
  });

  it('TEST-02. Persistencia: offers=false se envía correctamente al servicio existente y se refleja en la UI', async () => {
    await render(<NotificationPreferencesScreen />, { wrapper });
    const offers = await screen.findByRole('switch', { name: 'Ofertas' });
    await fireEvent.press(offers);

    await waitFor(() =>
      expect(notificationService.savePreferences).toHaveBeenCalledWith({
        ...initial,
        offers: false,
      }),
    );

    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Ofertas' })).toHaveProp(
        'accessibilityState',
        expect.objectContaining({ checked: false }),
      ),
    );
  });

  it('TEST-03. Restauración de preferencias: al cargar la pantalla se muestran los valores persistidos', async () => {
    const persisted = { pushEnabled: false, system: true, offers: false, rentals: true };
    jest.mocked(notificationService.preferences).mockResolvedValueOnce({ preferences: persisted });

    await render(<NotificationPreferencesScreen />, { wrapper });
    const offers = await screen.findByRole('switch', { name: 'Ofertas' });
    const push = await screen.findByRole('switch', { name: 'Recibir notificaciones push' });

    expect(offers).toHaveProp('accessibilityState', expect.objectContaining({ checked: false }));
    expect(push).toHaveProp('accessibilityState', expect.objectContaining({ checked: false }));
  });

  it('TEST-04. Activación posterior de push: desactivar ofertas con push desactivado y luego activar push no reactiva ofertas', async () => {
    const initialDisabledPush = { pushEnabled: false, system: true, offers: true, rentals: true };
    jest
      .mocked(notificationService.preferences)
      .mockResolvedValueOnce({ preferences: { ...initialDisabledPush } });

    await render(<NotificationPreferencesScreen />, { wrapper });
    const offers = await screen.findByRole('switch', { name: 'Ofertas' });
    await fireEvent.press(offers);

    await waitFor(() =>
      expect(notificationService.savePreferences).toHaveBeenLastCalledWith({
        pushEnabled: false,
        system: true,
        offers: false,
        rentals: true,
      }),
    );

    const push = screen.getByRole('switch', { name: 'Recibir notificaciones push' });
    await fireEvent.press(push);

    await waitFor(() =>
      expect(notificationService.savePreferences).toHaveBeenLastCalledWith({
        pushEnabled: true,
        system: true,
        offers: false,
        rentals: true,
      }),
    );

    expect(screen.getByRole('switch', { name: 'Ofertas' })).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ checked: false }),
    );
  });

  it('TEST-05. Error del servidor: informa al usuario y revierte la UI al valor confirmado previo', async () => {
    jest
      .mocked(notificationService.savePreferences)
      .mockRejectedValueOnce(new Error('Network error'));

    await render(<NotificationPreferencesScreen />, { wrapper });
    const offers = await screen.findByRole('switch', { name: 'Ofertas' });
    await fireEvent.press(offers);

    await waitFor(() => expect(mockShowError).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('switch', { name: 'Ofertas' })).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ checked: true }),
    );
  });

  it('TEST-06. Cambios rápidos: modificaciones consecutivas no duplican requests ni conservan resultados obsoletos', async () => {
    let resolveSave!: (val: { preferences: typeof initial }) => void;
    jest.mocked(notificationService.savePreferences).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );

    await render(<NotificationPreferencesScreen />, { wrapper });
    const offers = await screen.findByRole('switch', { name: 'Ofertas' });

    // Primer cambio
    await fireEvent.press(offers);
    expect(notificationService.savePreferences).toHaveBeenCalledTimes(1);

    // Segundo click mientras el primero está en vuelo
    await fireEvent.press(offers);
    // changing.current impide llamadas concurrentes
    expect(notificationService.savePreferences).toHaveBeenCalledTimes(1);

    resolveSave({ preferences: { ...initial, offers: false } });

    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Ofertas' })).toHaveProp(
        'accessibilityState',
        expect.objectContaining({ checked: false }),
      ),
    );
  });

  it('TEST-07. Protección de otras preferencias: cambiar ofertas conserva sistema, rentas y push general intactos', async () => {
    const custom = { pushEnabled: false, system: false, offers: true, rentals: true };
    jest
      .mocked(notificationService.preferences)
      .mockResolvedValueOnce({ preferences: { ...custom } });

    await render(<NotificationPreferencesScreen />, { wrapper });
    const offers = await screen.findByRole('switch', { name: 'Ofertas' });
    await fireEvent.press(offers);

    await waitFor(() =>
      expect(notificationService.savePreferences).toHaveBeenCalledWith({
        pushEnabled: false,
        system: false,
        offers: false,
        rentals: true,
      }),
    );
  });

  it('TEST-08. Sesión no autenticada: no permite guardar ni consultar preferencias privadas', async () => {
    mockAuth.status = 'guest';
    mockAuth.user = null;

    await render(<NotificationPreferencesScreen />, { wrapper });

    expect(screen.queryByRole('switch', { name: 'Ofertas' })).toBeNull();
    expect(notificationService.preferences).not.toHaveBeenCalled();
    expect(notificationService.savePreferences).not.toHaveBeenCalled();
  });

  it('TEST-09. Accesibilidad: los controles cuentan con roles, etiquetas y estados accesibles adecuados', async () => {
    const initialDisabledPush = { pushEnabled: false, system: true, offers: true, rentals: true };
    jest
      .mocked(notificationService.preferences)
      .mockResolvedValueOnce({ preferences: { ...initialDisabledPush } });

    await render(<NotificationPreferencesScreen />, { wrapper });

    const pushSwitch = await screen.findByRole('switch', { name: 'Recibir notificaciones push' });
    const offersSwitch = screen.getByRole('switch', { name: 'Ofertas' });
    const systemSwitch = screen.getByRole('switch', { name: 'Sistema y seguridad' });
    const rentalsSwitch = screen.getByRole('switch', { name: 'Rentas' });

    expect(pushSwitch).toHaveProp('accessibilityRole', 'switch');
    expect(pushSwitch).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ checked: false, disabled: false }),
    );

    // Ofertas es independiente y no está deshabilitado aunque pushEnabled sea false
    expect(offersSwitch).toHaveProp('accessibilityRole', 'switch');
    expect(offersSwitch).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ checked: true, disabled: false }),
    );

    // Sistema y rentas están deshabilitados cuando pushEnabled es false
    expect(systemSwitch).toHaveProp('accessibilityRole', 'switch');
    expect(systemSwitch).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ checked: true, disabled: true }),
    );

    expect(rentalsSwitch).toHaveProp('accessibilityRole', 'switch');
    expect(rentalsSwitch).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ checked: true, disabled: true }),
    );
  });
});
