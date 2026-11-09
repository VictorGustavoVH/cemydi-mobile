import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { render } from '../../../../tests/support/render-with-toast';
import { ApiError } from '@/services/http/api-error';
import { ConfiguredGoogleAuthButton, GoogleAuthButton } from '../components/GoogleAuthButton';

const mockLogin = jest.fn();
const mockReplace = jest.fn();
const mockSignIn = jest.fn();
const mockCreateAccount = jest.fn();
const mockExplicit = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, canDismiss: () => false }),
}));
jest.mock('@/providers/auth-provider', () => ({
  ...jest.requireActual('@/providers/auth-provider'),
  useAuth: () => ({
    service: { loginWithGoogle: mockLogin },
  }),
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    executionEnvironment: 'standalone',
    expoConfig: { extra: { googleNativeConfigured: true } },
  },
  ExecutionEnvironment: { StoreClient: 'storeClient' },
}));
jest.mock('react-native-nitro-google-signin', () => ({
  GoogleOneTapSignIn: {
    configure: jest.fn(),
    checkPlayServices: jest.fn(async () => undefined),
    signIn: () => mockSignIn(),
    createAccount: () => mockCreateAccount(),
    presentExplicitSignIn: () => mockExplicit(),
  },
  isSuccessResponse: (response: { type: string }) => response.type === 'success',
  isCancelledResponse: (response: { type: string }) => response.type === 'cancelled',
  isNoSavedCredentialFoundResponse: (response: { type: string }) =>
    response.type === 'noSavedCredentialFound',
}));
beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'android');
  mockSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'fixture-id-token' } });
  mockExplicit.mockResolvedValue({ type: 'success', data: { idToken: 'fixture-id-token' } });
  mockLogin.mockResolvedValue(undefined);
});
afterAll(() => jest.restoreAllMocks());
it('envía la identidad al backend y deja la navegación a la pantalla de acceso', async () => {
  await render(
    <ConfiguredGoogleAuthButton
      disabled={false}
      remember={false}
      webClientId="fixture.apps.googleusercontent.com"
    />,
  );
  await fireEvent.press(screen.getByLabelText('Continuar con Google'));
  await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('fixture-id-token', false));
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockExplicit).toHaveBeenCalledTimes(1);
  expect(mockSignIn).not.toHaveBeenCalled();
});
it('no persiste la sesión de Google cuando la pantalla no lo pide', async () => {
  const previousClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'fixture.apps.googleusercontent.com';
  try {
    await render(<GoogleAuthButton disabled={false} />);
    await fireEvent.press(screen.getByLabelText('Continuar con Google'));
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('fixture-id-token', false));
  } finally {
    if (previousClientId === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    else process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = previousClientId;
  }
});
it('muestra aviso cuando Google termina sin identidad, sin navegar ni iniciar sesión', async () => {
  mockExplicit.mockResolvedValue({ type: 'cancelled' });
  await render(
    <ConfiguredGoogleAuthButton
      disabled={false}
      remember={true}
      webClientId="fixture.apps.googleusercontent.com"
    />,
  );
  await fireEvent.press(screen.getByLabelText('Continuar con Google'));
  await screen.findByText('Google no completó el acceso. Intenta de nuevo cuando quieras.');
  expect(mockLogin).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});
it('muestra error de validación en toast si Google entrega identidad pero el backend la rechaza', async () => {
  mockLogin.mockRejectedValue(new ApiError('invalid audience', { kind: 'http', status: 401 }));
  await render(
    <ConfiguredGoogleAuthButton
      disabled={false}
      remember={true}
      webClientId="fixture.apps.googleusercontent.com"
    />,
  );
  await fireEvent.press(screen.getByLabelText('Continuar con Google'));
  await screen.findByText(
    'No pudimos validar tu cuenta de Google. Intenta de nuevo o inicia sesión con tu correo.',
  );
  expect(mockReplace).not.toHaveBeenCalled();
  expect(screen.queryByText('invalid audience')).toBeNull();
});
it('no muestra instrucciones de OAuth ni códigos nativos en el error de configuración', async () => {
  mockExplicit.mockRejectedValue(
    Object.assign(new Error('DEVELOPER_ERROR SHA-1 mismatch'), { code: 'DEVELOPER_ERROR' }),
  );
  await render(
    <ConfiguredGoogleAuthButton
      disabled={false}
      remember={true}
      webClientId="fixture.apps.googleusercontent.com"
    />,
  );
  await fireEvent.press(screen.getByLabelText('Continuar con Google'));
  await screen.findByText(
    'El acceso con Google no está disponible en esta versión. Puedes usar tu correo y contraseña.',
  );
  expect(screen.queryByText(/SHA-1 mismatch/)).toBeNull();
  expect(mockLogin).not.toHaveBeenCalled();
});
