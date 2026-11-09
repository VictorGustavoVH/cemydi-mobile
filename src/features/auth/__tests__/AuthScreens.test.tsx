import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { BackHandler, Linking, View } from 'react-native';
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
import { installProfileApiMock, PROFILE_USER } from '../../../../tests/support/profile-api-mock';
import { installNetworkMock } from '../../../../tests/support/network-mock';
import { profileService } from '@/features/profile/profile-service';
import { AuthHeaderMenu } from '../components/AuthHeaderMenu';
import { AppButton } from '@/components/ui/AppButton';

const mockRouter = {
  replace: jest.fn(),
  push: jest.fn(),
  canDismiss: jest.fn(() => false),
  dismiss: jest.fn(),
  navigate: jest.fn(),
};
const mockNavigation = {
  getState: () => ({ index: 1, routes: [{ name: '(tabs)' }, { name: 'login' }] }),
};
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  return {
    useRouter: () => mockRouter,
    useNavigation: () => mockNavigation,
    useFocusEffect: (callback: () => void | (() => void)) => {
      const { useEffect } = jest.requireActual<typeof import('react')>('react');
      useEffect(callback, [callback]);
    },
    Redirect: ({ href }: { href: string }) => <Text>{`Redirect:${href}`}</Text>,
  };
});

async function enter(label: string, value: string) {
  await fireEvent.changeText(screen.getByLabelText(label), value);
}
const withAuth = (element: React.ReactElement) => element;
jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(),
  addNetworkStateListener: jest.fn(),
}));

describe('Formularios y navegación de autenticación', () => {
  it('espera a comprobar el perfil y permite continuar en Perfil si la consulta falla', async () => {
    let fail!: (error: Error) => void;
    jest.spyOn(profileService, 'get').mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    await render(<LoginScreen />);
    await enter('Correo electrónico', DEFAULT_ACCOUNT.correo);
    await enter('Contraseña', DEFAULT_ACCOUNT.password);
    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(profileService.get).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('Continuando…')).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await act(async () => fail(new Error('No disponible')));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/perfil'));
  });
  it.each([
    ['teléfono ausente', null, 'Domicilio de prueba', '/perfil'],
    ['dirección ausente', '5550001234', '   ', '/perfil'],
    ['perfil completo', '5550001234', 'Domicilio de prueba', '/inicio'],
  ])('después del login dirige según %s', async (_name, telefono, direccion, destination) => {
    installProfileApiMock({ ...PROFILE_USER, telefono, direccion });
    await render(<LoginScreen />);
    await enter('Correo electrónico', DEFAULT_ACCOUNT.correo);
    await enter('Contraseña', DEFAULT_ACCOUNT.password);
    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(destination));
  });
  beforeEach(() => {
    installAuthApiMock();
    installNetworkMock();
    jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(function (
      this: View,
      callback,
    ) {
      if (this.props.testID === 'screen-overlay-host') callback(0, 44, 390, 700);
      else callback(326, 48, 44, 44);
    });
  });
  it.each([
    ['login', LoginScreen],
    ['registro', RegisterScreen],
  ])(
    'ofrece un desplegable con texto negro y cierre al tocar fuera o Atrás en %s',
    async (_name, Screen) => {
      const backHandler = jest.spyOn(BackHandler, 'addEventListener');
      await render(<Screen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Opciones de acceso' }));
      expect(screen.getByText('Verificar cuenta')).toHaveStyle({ color: '#000000' });
      expect(screen.getByText('Ayuda')).toHaveStyle({ color: '#000000' });
      await fireEvent.press(screen.getByRole('button', { name: 'Cerrar desplegable' }));
      expect(screen.queryByRole('button', { name: 'Ayuda' })).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: 'Opciones de acceso' }));
      const onBack = backHandler.mock.calls.at(-1)?.[1];
      await act(async () =>
        expect(onBack?.({ type: 'hardwareBackPress', timeStamp: Date.now() })).toBe(true),
      );
      expect(screen.queryByRole('button', { name: 'Ayuda' })).toBeNull();
      expect(mockRouter.replace).not.toHaveBeenCalled();
    },
  );
  it('cierra el menú de acceso si la pantalla se deshabilita', async () => {
    function MenuHarness() {
      const [disabled, setDisabled] = useState(false);
      return (
        <>
          <AuthHeaderMenu disabled={disabled} onVerify={() => undefined} onHelp={() => undefined} />
          <AppButton
            label={disabled ? 'Habilitar menú' : 'Deshabilitar menú'}
            onPress={() => setDisabled((current) => !current)}
          />
        </>
      );
    }
    await render(<MenuHarness />);
    await fireEvent.press(screen.getByRole('button', { name: 'Opciones de acceso' }));
    expect(screen.getByRole('button', { name: 'Ayuda' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Deshabilitar menú' }));
    expect(screen.queryByRole('button', { name: 'Ayuda' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Habilitar menú' }));
    expect(screen.queryByRole('button', { name: 'Ayuda' })).toBeNull();
  });
  it('solicita verificación desde registro sin crear una cuenta ni exigir contraseña o términos', async () => {
    await render(<RegisterScreen />);
    await enter('Correo electrónico', 'cliente@cemydi.test');
    await fireEvent.press(screen.getByRole('button', { name: 'Opciones de acceso' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Verificar cuenta' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/otp'));
    expect(fetch).toHaveBeenCalledWith(
      'https://cemydi.test.invalid/auth/email-verification/send',
      expect.objectContaining({ body: JSON.stringify({ correo: 'cliente@cemydi.test' }) }),
    );
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/auth/register'),
      expect.anything(),
    );
  });
  it('abre la recuperación desde el enlace junto al título del campo de contraseña', async () => {
    await render(<LoginScreen />);
    const link = screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' });
    await fireEvent.press(link);
    expect(mockRouter.replace).toHaveBeenCalledWith('/forgot-password');
    expect(screen.getByLabelText('Contraseña')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Requisitos de contraseña' })).toBeTruthy();
  });
  it('permite solicitar verificación de correo sin ingresar contraseña', async () => {
    await render(<LoginScreen />);
    await enter('Correo electrónico', 'cliente@cemydi.test');
    expect(screen.queryByRole('button', { name: 'Verificar cuenta' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Opciones de acceso' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Verificar cuenta' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/otp'));
    expect(fetch).toHaveBeenCalledWith(
      'https://cemydi.test.invalid/auth/email-verification/send',
      expect.objectContaining({ body: JSON.stringify({ correo: 'cliente@cemydi.test' }) }),
    );
  });
  it('el menú permite consultar ayuda sin iniciar sesión y se cierra al elegirla', async () => {
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Opciones de acceso' }));
    expect(screen.getByRole('button', { name: 'Opciones de acceso' })).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ expanded: true }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Ayuda' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/perfil/ayuda');
    expect(screen.queryByRole('button', { name: 'Ayuda' })).toBeNull();
    expect(screen.getByLabelText('Correo electrónico')).toBeTruthy();
  });
  it('verificar desde el menú solicita un correo válido y conserva la contraseña vacía', async () => {
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Opciones de acceso' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Verificar cuenta' }));
    expect(await screen.findByText('Ingresa tu correo electrónico')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Verificar cuenta' })).toBeNull();
    expect(screen.getByLabelText('Contraseña')).toHaveProp('value', '');
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/auth/email-verification/send'),
      expect.anything(),
    );
  });
  it('Atrás en login cierra el formulario y conserva el origen sin abrir el destino pendiente', async () => {
    mockRouter.canDismiss.mockReturnValueOnce(true);
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByLabelText('Volver'));
    expect(mockRouter.dismiss).toHaveBeenCalledTimes(1);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
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
      screen.getByText('Para continuar con Google, abre la app CEMYDI instalada en tu teléfono.'),
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
    expect(screen.queryByLabelText('Correo electrónico')).toBeNull();
    expect(screen.queryByLabelText('Contraseña')).toBeNull();
    expect(screen.getByLabelText('Continuando…')).toBeTruthy();
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
    await waitFor(() => expect(mockRouter.replace).toHaveBeenLastCalledWith('/perfil'));
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
    expect(screen.getByText('Redirect:/login')).toBeTruthy();
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
