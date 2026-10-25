import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { render } from '../../../../tests/support/render-with-toast';
import { LoginScreen } from '../LoginScreen';
import { RegisterScreen } from '../RegisterScreen';
import { ForgotPasswordScreen } from '../ForgotPasswordScreen';
import { OtpScreen } from '../OtpScreen';
import { NewPasswordScreen } from '../NewPasswordScreen';
import {
  AUTH_ACCOUNT as DEFAULT_ACCOUNT,
  installAuthApiMock,
} from '../../../../tests/support/auth-api-mock';
import { colors } from '@/theme';

const mockRouter = {
  replace: jest.fn(),
  push: jest.fn(),
  canDismiss: jest.fn(() => false),
  dismiss: jest.fn(),
  navigate: jest.fn(),
};
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  return {
    useRouter: () => mockRouter,
    Redirect: ({ href }: { href: string }) => <Text>{`Redirect:${href}`}</Text>,
  };
});

async function enter(label: string, value: string) {
  await fireEvent.changeText(screen.getByLabelText(label), value);
}
const withAuth = (element: React.ReactElement) => element;

describe('Formularios y navegación de autenticación', () => {
  beforeEach(() => installAuthApiMock());
  it('permite solicitar verificación de correo sin ingresar contraseña', async () => {
    await render(<LoginScreen />);
    await enter('Correo electrónico', 'cliente@cemydi.test');
    await fireEvent.press(screen.getByLabelText('Verificar mi correo'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/otp'));
    expect(fetch).toHaveBeenCalledWith(
      'https://cemydi.test.invalid/auth/email-verification/send',
      expect.objectContaining({ body: JSON.stringify({ correo: 'cliente@cemydi.test' }) }),
    );
  });
  it('Atrás en login cierra el login y vuelve a la pestaña pendiente', async () => {
    mockRouter.canDismiss.mockReturnValueOnce(true);
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByLabelText('Volver'));
    expect(mockRouter.dismiss).toHaveBeenCalledTimes(1);
    expect(mockRouter.navigate).toHaveBeenCalledWith('/inicio');
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
  it('conserva el correo al corregirlo desde OTP sin conservar el código', async () => {
    const view = await render(withAuth(<ForgotPasswordScreen />));
    await enter('Correo electrónico', DEFAULT_ACCOUNT.correo);
    await fireEvent.press(screen.getByLabelText('Enviar código'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/otp'));
    await view.rerender(withAuth(<OtpScreen />));
    await enter('Código de verificación de 8 dígitos', '1234');
    await fireEvent.press(screen.getByLabelText('Cambiar correo'));
    await view.rerender(withAuth(<ForgotPasswordScreen />));
    expect(screen.getByLabelText('Correo electrónico')).toHaveProp('value', DEFAULT_ACCOUNT.correo);
  });
  it('valida login vacío, muestra/oculta contraseña, identifica Expo Go y URL legal ausente', async () => {
    delete process.env.EXPO_PUBLIC_WEBSITE_URL;
    jest.replaceProperty(Constants, 'executionEnvironment', ExecutionEnvironment.StoreClient);
    await render(withAuth(<LoginScreen />));
    expect(screen.queryByRole('checkbox', { name: /Acepto/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByText('Ingresa tu correo electrónico')).toBeTruthy();
    expect(screen.getByText('Ingresa tu contraseña')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Mostrar contraseña'));
    expect(screen.getByLabelText('Contraseña')).toHaveProp('secureTextEntry', false);
    await fireEvent.press(screen.getByLabelText('Ocultar contraseña'));
    expect(screen.getByLabelText('Contraseña')).toHaveProp('secureTextEntry', true);
    await fireEvent.press(screen.getByLabelText('Continuar con Google'));
    expect(
      screen.getByText(
        'Abre la app CEMYDI instalada para continuar con Google. Expo Go no admite esta función.',
      ),
    ).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('link', { name: 'Términos y condiciones' }));
    expect(screen.getByText('No se pudo abrir la página. Intenta más tarde.')).toBeTruthy();
  });

  it('rechaza credenciales incorrectas y recuerda solo el correo después de entrar', async () => {
    const view = await render(withAuth(<LoginScreen />));
    await enter('Correo electrónico', DEFAULT_ACCOUNT.correo);
    await enter('Contraseña', 'incorrecta');
    await fireEvent.press(screen.getByLabelText('Iniciar sesión'));
    expect(
      await screen.findByText(
        'No se pudo validar el acceso. Revisa tus datos y verifica tu correo.',
      ),
    ).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await enter('Contraseña', DEFAULT_ACCOUNT.password);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Mantener sesión iniciada' }));
    await fireEvent.press(screen.getByLabelText('Iniciar sesión'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/inicio'));
    await view.rerender(withAuth(<ForgotPasswordScreen />));
    await view.rerender(withAuth(<LoginScreen />));
    expect(screen.getByLabelText('Correo electrónico')).toHaveProp('value', DEFAULT_ACCOUNT.correo);
    expect(screen.getByLabelText('Contraseña')).toHaveProp('value', '');
  });

  it('exige términos en registro y verifica el correo antes de permitir login', async () => {
    const view = await render(withAuth(<RegisterScreen />));
    await enter('Nombre completo', 'José María');
    await enter('Correo electrónico', 'jose@cemydi.test');
    await enter('Contraseña', 'Password12!');
    await enter('Confirmar contraseña', 'Password12!');
    expect(screen.getByRole('progressbar')).toHaveProp('accessibilityValue', {
      min: 0,
      max: 4,
      now: 4,
      text: 'Alta',
    });
    await fireEvent.press(screen.getByLabelText('Crear cuenta'));
    expect(
      await screen.findByText('Debes aceptar los términos y condiciones para continuar'),
    ).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('checkbox', { name: /Acepto los términos/ }));
    await fireEvent.press(screen.getByLabelText('Crear cuenta'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/otp'));
    await view.rerender(withAuth(<OtpScreen />));
    await enter('Código de verificación de 8 dígitos', '00000000');
    await fireEvent.press(screen.getByLabelText('Verificar código'));
    await waitFor(() =>
      expect(screen.getByTestId('otp-cell-0', { includeHiddenElements: true })).toHaveStyle({
        borderColor: colors.success,
      }),
    );
    expect(screen.getByLabelText('Código de verificación de 8 dígitos')).toHaveProp(
      'editable',
      false,
    );
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/login'));
    await view.rerender(withAuth(<LoginScreen />));
    await enter('Correo electrónico', 'jose@cemydi.test');
    await enter('Contraseña', 'Password12!');
    await fireEvent.press(screen.getByLabelText('Iniciar sesión'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenLastCalledWith('/inicio'));
  });

  it('recupera la cuenta, pega OTP con espacios y acepta únicamente la nueva contraseña', async () => {
    const view = await render(withAuth(<ForgotPasswordScreen />));
    await enter('Correo electrónico', DEFAULT_ACCOUNT.correo);
    await fireEvent.press(screen.getByLabelText('Enviar código'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/otp'));
    await view.rerender(withAuth(<OtpScreen />));
    expect(screen.getByLabelText('Reenviar en 60s')).toBeDisabled();
    await enter('Código de verificación de 8 dígitos', '12345678');
    await fireEvent.press(screen.getByLabelText('Verificar código'));
    expect(
      await screen.findByText(
        'Los datos o el código son inválidos o expiraron. Revisa e intenta de nuevo.',
      ),
    ).toBeTruthy();
    await enter('Código de verificación de 8 dígitos', '0000 0000');
    expect(screen.getByLabelText('Código de verificación de 8 dígitos')).toHaveProp(
      'value',
      '00000000',
    );
    await fireEvent.press(screen.getByLabelText('Verificar código'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/new-password'));
    await view.rerender(withAuth(<NewPasswordScreen />));
    await enter('Nueva contraseña', 'NuevaClave1!');
    await enter('Confirmar nueva contraseña', 'OtraClave12!');
    await fireEvent.press(screen.getByLabelText('Guardar contraseña'));
    expect(await screen.findByText('Las contraseñas no coinciden')).toBeTruthy();
    await enter('Confirmar nueva contraseña', 'NuevaClave1!');
    await fireEvent.press(screen.getByLabelText('Guardar contraseña'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/login'));
    await view.rerender(withAuth(<LoginScreen />));
    await enter('Correo electrónico', DEFAULT_ACCOUNT.correo);
    await enter('Contraseña', DEFAULT_ACCOUNT.password);
    await fireEvent.press(screen.getByLabelText('Iniciar sesión'));
    expect(
      await screen.findByText(
        'No se pudo validar el acceso. Revisa tus datos y verifica tu correo.',
      ),
    ).toBeTruthy();
    await enter('Contraseña', 'NuevaClave1!');
    await fireEvent.press(screen.getByLabelText('Iniciar sesión'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenLastCalledWith('/inicio'));
  });

  it('bloquea accesos directos sin desafío de verificación', async () => {
    const view = await render(withAuth(<OtpScreen />));
    expect(screen.getByText('Redirect:/forgot-password')).toBeTruthy();
    await view.rerender(withAuth(<NewPasswordScreen />));
    expect(screen.getByText('Redirect:/forgot-password')).toBeTruthy();
  });

  it('abre las páginas legales configuradas y muestra error ante URL inválida o fallo de apertura', async () => {
    const originalUrl = process.env.EXPO_PUBLIC_WEBSITE_URL;
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    try {
      process.env.EXPO_PUBLIC_WEBSITE_URL = 'https://cemydi.test/';
      await render(withAuth(<LoginScreen />));
      await fireEvent.press(screen.getByRole('link', { name: 'Términos y condiciones' }));
      expect(openURL).toHaveBeenCalledWith('https://cemydi.test/terminos-y-condiciones');
      await fireEvent.press(screen.getByRole('link', { name: 'Aviso de privacidad' }));
      expect(openURL).toHaveBeenCalledWith('https://cemydi.test/politicas-de-privacidad');
      openURL.mockRejectedValueOnce(new Error('Sin navegador'));
      await fireEvent.press(screen.getByRole('link', { name: 'Aviso de privacidad' }));
      expect(
        await screen.findByText('No se pudo abrir la página. Intenta más tarde.'),
      ).toBeTruthy();
      process.env.EXPO_PUBLIC_WEBSITE_URL = 'javascript:alert(1)';
      await fireEvent.press(screen.getByRole('link', { name: 'Términos y condiciones' }));
      expect(openURL).toHaveBeenCalledTimes(3);
    } finally {
      if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_WEBSITE_URL;
      else process.env.EXPO_PUBLIC_WEBSITE_URL = originalUrl;
    }
  });

  it('habilita reenvío tras 60 segundos y limpia el código al reenviar', async () => {
    jest.useFakeTimers();
    try {
      const view = await render(withAuth(<ForgotPasswordScreen />));
      await enter('Correo electrónico', DEFAULT_ACCOUNT.correo);
      await fireEvent.press(screen.getByLabelText('Enviar código'));
      await act(async () => {
        await Promise.resolve();
      });
      await view.rerender(withAuth(<OtpScreen />));
      await enter('Código de verificación de 8 dígitos', '1234');
      await act(async () => {
        jest.advanceTimersByTime(60_000);
      });
      expect(screen.getByLabelText('Reenviar código')).toBeEnabled();
      await fireEvent.press(screen.getByLabelText('Reenviar código'));
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByLabelText('Código de verificación de 8 dígitos')).toHaveProp('value', '');
      expect(screen.getByLabelText('Reenviar en 60s')).toBeDisabled();
      await view.unmount();
    } finally {
      jest.useRealTimers();
    }
  });
});
