import { useEffect, type ComponentType } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { render } from '../support/render-with-toast';
import { installNetworkMock } from '../support/network-mock';
import { installAuthApiMock, AUTH_ACCOUNT } from '../support/auth-api-mock';
import { installProfileApiMock, PROFILE_USER } from '../support/profile-api-mock';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { createAuthSession } from '@/features/auth/services/auth-session';
import { CatalogPreviewProvider } from '@/providers/catalog-preview-provider';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { RegisterScreen } from '@/features/auth/RegisterScreen';
import { ForgotPasswordScreen } from '@/features/auth/ForgotPasswordScreen';
import { OtpScreen } from '@/features/auth/OtpScreen';
import { NewPasswordScreen } from '@/features/auth/NewPasswordScreen';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { NotificationPreferencesScreen } from '@/features/notifications/NotificationPreferencesScreen';
import { notificationService } from '@/features/notifications/notification-service';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: () => true,
  navigate: jest.fn(),
  canDismiss: jest.fn(() => false),
  dismiss: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useNavigation: () => ({
    getState: () => ({ index: 1, routes: [{ name: '(tabs)' }, { name: 'login' }] }),
  }),
  usePathname: () => '/login',
  useLocalSearchParams: () => ({}),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useEffect: effect } = jest.requireActual<typeof import('react')>('react');
    effect(callback, [callback]);
  },
  Redirect: () => null,
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
}));

let controls: ReturnType<typeof useAuth>;

function AuthWatcher({
  Screen,
  initialAction,
}: {
  Screen: ComponentType;
  initialAction?: (auth: ReturnType<typeof useAuth>) => Promise<void> | void;
}) {
  const auth = useAuth();
  useEffect(() => {
    controls = auth;
  }, [auth]);
  useEffect(() => {
    if (initialAction) {
      void initialAction(auth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Screen />;
}

const show = (
  Screen: ComponentType,
  initialAction?: (auth: ReturnType<typeof useAuth>) => Promise<void> | void,
) =>
  render(
    <CatalogPreviewProvider>
      <AuthWatcher Screen={Screen} initialAction={initialAction} />
    </CatalogPreviewProvider>,
  );

describe('NOV-04 y NOV-05: Pruebas de caja negra de autenticación, perfil y ARCO', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installNetworkMock();
    installAuthApiMock();
    installProfileApiMock({
      ...PROFILE_USER,
      telefono: '5550001234',
      direccion: 'Domicilio de prueba',
    });
  });

  // =========================================================================
  // NOV-04: Autenticación, sesión y perfil
  // =========================================================================

  test('E2E-AUTH-01: inicio de sesión válido navega y publica sesión autenticada', async () => {
    await show(LoginScreen);
    await screen.findByRole('button', { name: 'Iniciar sesión' });

    await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), AUTH_ACCOUNT.correo);
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), AUTH_ACCOUNT.password);
    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => expect(controls.status).toBe('authenticated'));
    expect(controls.user?.correo).toBe(AUTH_ACCOUNT.correo);
    expect(controls.user?.nombre).toBe(AUTH_ACCOUNT.nombre);
    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith(expect.stringMatching(/\/inicio|\/perfil/)),
    );
  });

  test('E2E-AUTH-02: credenciales incorrectas muestran error y mantienen al usuario en el formulario', async () => {
    await show(LoginScreen);
    await screen.findByRole('button', { name: 'Iniciar sesión' });

    await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'invalido@cemydi.test');
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'ClaveErronea123!');
    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await screen.findByText('No se pudo validar el acceso. Revisa tus datos y verifica tu correo.');
    expect(controls.status).toBe('guest');
    expect(controls.user).toBeNull();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  test('E2E-AUTH-03: sesión caducada presenta aviso accesible de vencimiento', async () => {
    const session = createAuthSession({
      get: async () => null,
      set: async () => undefined,
      remove: async () => undefined,
    });
    session.expire();

    await render(
      <AuthProvider session={session}>
        <LoginScreen />
      </AuthProvider>,
    );

    expect(await screen.findByText('Tu sesión venció. Inicia sesión para continuar.')).toBeTruthy();
    expect(screen.getByLabelText('Correo electrónico')).toBeTruthy();
  });

  test('E2E-AUTH-04: cierre de sesión requiere confirmación y limpia datos privados de pantalla', async () => {
    await show(ProfileScreen, async (auth) => {
      await auth.service.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, false);
    });

    await screen.findByLabelText('Datos personales');
    await waitFor(() => expect(controls.status).toBe('authenticated'));

    await fireEvent.press(screen.getByLabelText('Cerrar sesión'));
    expect(screen.getByText('¿Cerrar sesión?')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Salir'));
    await waitFor(() => expect(controls.status).toBe('guest'));
    expect(controls.user).toBeNull();
    await waitFor(() => expect(mockRouter.navigate).toHaveBeenCalledWith('/inicio'));
  });

  test('E2E-AUTH-05: aislamiento entre cuentas previene reutilización de datos de sesión previa', async () => {
    const ACCOUNT_B = {
      nombre: 'Segundo Cliente E2E',
      correo: 'usuario2@cemydi.test',
      password: 'FixturePassword2!',
    };
    installAuthApiMock([ACCOUNT_B]);

    // 1. Iniciar sesión con Cuenta A
    await show(LoginScreen);
    await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), AUTH_ACCOUNT.correo);
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), AUTH_ACCOUNT.password);
    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => expect(controls.status).toBe('authenticated'));
    expect(controls.user?.nombre).toBe(AUTH_ACCOUNT.nombre);
    expect(controls.user?.correo).toBe(AUTH_ACCOUNT.correo);

    // 2. Cerrar sesión
    await act(async () => {
      await controls.logout();
    });
    expect(controls.status).toBe('guest');
    expect(controls.user).toBeNull();

    // 3. Iniciar sesión con Cuenta B
    await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), ACCOUNT_B.correo);
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), ACCOUNT_B.password);
    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => expect(controls.status).toBe('authenticated'));
    expect(controls.user?.correo).toBe(ACCOUNT_B.correo);
    expect(controls.user?.nombre).toBe(ACCOUNT_B.nombre);
    expect(controls.user?.correo).not.toBe(AUTH_ACCOUNT.correo);
  });

  test('E2E-PROFILE-04: recuperación de contraseña con validación de código OTP sintético y cambio', async () => {
    // 1. Solicitar código de recuperación
    const view = await show(ForgotPasswordScreen);
    await screen.findByText('¿Olvidaste tu contraseña?');

    await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), AUTH_ACCOUNT.correo);
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar código' }));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/otp'));
    expect(controls.challenge?.purpose).toBe('recovery');

    // 2. Introducir código OTP inválido y después código válido
    await view.rerender(
      <CatalogPreviewProvider>
        <AuthWatcher Screen={OtpScreen} />
      </CatalogPreviewProvider>,
    );

    await screen.findByText('Revisa tu correo');
    await fireEvent.changeText(
      screen.getByLabelText('Código de verificación de 8 dígitos'),
      '99999999',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Verificar código' }));
    expect(
      await screen.findByText(
        'Los datos o el código son inválidos o expiraron. Revisa e intenta de nuevo.',
      ),
    ).toBeTruthy();

    await fireEvent.changeText(
      screen.getByLabelText('Código de verificación de 8 dígitos'),
      '00000000',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Verificar código' }));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/new-password'), {
      timeout: 3000,
    });

    // 3. Actualizar contraseña
    await view.rerender(
      <CatalogPreviewProvider>
        <AuthWatcher Screen={NewPasswordScreen} />
      </CatalogPreviewProvider>,
    );

    await screen.findByLabelText('Nueva contraseña');
    await fireEvent.changeText(screen.getByLabelText('Nueva contraseña'), 'NuevaSegura123!');
    await fireEvent.changeText(
      screen.getByLabelText('Confirmar nueva contraseña'),
      'NuevaSegura123!',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar contraseña' }));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/login'));
  });

  // =========================================================================
  // NOV-05: Carrito remoto, solicitudes de renta, notificaciones y ARCO
  // =========================================================================

  test('E2E-ARCO-04: derecho de oposición promocional independiente de notificaciones push generales', async () => {
    const preferencesMock = {
      pushEnabled: false,
      system: true,
      offers: true,
      rentals: true,
    };
    const saveSpy = jest.spyOn(notificationService, 'savePreferences').mockResolvedValue({
      preferences: { ...preferencesMock, offers: false },
    });
    jest.spyOn(notificationService, 'preferences').mockResolvedValue({
      preferences: preferencesMock,
    });

    await show(NotificationPreferencesScreen, async (auth) => {
      await auth.service.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, false);
    });

    await screen.findByText('Ajustes de notificaciones');
    const offersSwitch = await screen.findByLabelText('Ofertas');

    expect(offersSwitch).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ disabled: false }),
    );

    await fireEvent(offersSwitch, 'valueChange', false);

    await waitFor(() =>
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          pushEnabled: false,
          offers: false,
        }),
      ),
    );
  });

  test('E2E-ARCO-05: consentimiento previo obligatorio y aviso de privacidad en registro tradicional', async () => {
    await show(RegisterScreen);
    await screen.findByRole('button', { name: 'Crear cuenta' });

    // 1. Checkbox desmarcado por defecto
    const termsCheckbox = screen.getByRole('checkbox', {
      name: 'Acepto los términos y condiciones y el aviso de privacidad',
    });
    expect(termsCheckbox).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ checked: false }),
    );

    // 2. Rellenar formulario pero sin aceptar términos
    await fireEvent.changeText(screen.getByLabelText('Nombre completo'), 'Nuevo Aspirante');
    await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'nuevo@aspirante.test');
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'ContrasenaSegura123!');
    await fireEvent.changeText(
      screen.getByLabelText('Confirmar contraseña'),
      'ContrasenaSegura123!',
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(
      await screen.findByText('Acepta los términos y condiciones para registrarte.'),
    ).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();

    // 3. Aceptar términos y proceder
    await fireEvent.press(termsCheckbox);
    expect(termsCheckbox).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ checked: true }),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Crear cuenta' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/otp'));
  });
});
