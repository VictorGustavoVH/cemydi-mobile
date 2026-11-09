import { useEffect } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { render } from '../support/render-with-toast';
import { installNetworkMock } from '../support/network-mock';
import { installAuthApiMock, AUTH_ACCOUNT, jsonResponse } from '../support/auth-api-mock';
import { useAuth } from '@/providers/auth-provider';
import { AccountDeletionScreen } from '@/features/profile/AccountDeletionScreen';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  navigate: jest.fn(),
  back: jest.fn(),
  canGoBack: () => true,
};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useEffect: effect } = jest.requireActual<typeof import('react')>('react');
    effect(callback, [callback]);
  },
}));
let controls: ReturnType<typeof useAuth>;
function Connected() {
  const auth = useAuth();
  useEffect(() => {
    controls = auth;
  }, [auth]);
  useEffect(() => {
    void auth.service.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, false);
  }, [auth.service]);
  return <AccountDeletionScreen />;
}
function install(status = 'WAITING_OBLIGATIONS') {
  installNetworkMock();
  installAuthApiMock();
  const original = jest.mocked(fetch).getMockImplementation()!;
  const requests: string[] = [];
  jest.mocked(fetch).mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === '/account-deletion/me')
      return jsonResponse({
        request: null,
        pendingObligations: status === 'WAITING_OBLIGATIONS' ? 1 : 0,
      });
    if (path === '/account-deletion/request') {
      requests.push('request');
      return jsonResponse({
        message: 'Enviado',
        resendAt: new Date(Date.now() + 60000).toISOString(),
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      });
    }
    if (path === '/account-deletion/confirm') {
      requests.push('confirm');
      return jsonResponse({
        id: '0cb2c7f9-e344-41f7-a307-c3a6adbde419',
        status,
        message:
          status === 'WAITING_OBLIGATIONS'
            ? 'Resuelve tus rentas pendientes.'
            : 'La eliminación está en proceso.',
      });
    }
    return original(input, init);
  });
  return requests;
}
async function confirm() {
  await fireEvent.press(await screen.findByLabelText('Enviar código para eliminar mi cuenta'));
  await fireEvent.changeText(
    await screen.findByLabelText('Código de verificación de 8 dígitos'),
    '12345678',
  );
  await fireEvent.press(screen.getByLabelText('Confirmar eliminación definitiva'));
}
beforeEach(() => jest.clearAllMocks());
test('a pending rental acknowledges the request and preserves access to resolve it', async () => {
  const requests = install();
  await render(<Connected />);
  await confirm();
  expect(await screen.findByText('Resuelve tus rentas pendientes.')).toBeTruthy();
  expect(controls.status).toBe('authenticated');
  expect(requests).toEqual(['request', 'confirm']);
  await fireEvent.press(screen.getByLabelText('Consultar mis rentas'));
  expect(mockRouter.replace).toHaveBeenCalledWith('/perfil/rentas');
});
test('confirmed cleanup closes local access and keeps a visible receipt', async () => {
  install('PROCESSING');
  await render(<Connected />);
  await confirm();
  await waitFor(() => expect(controls.status).toBe('guest'));
  expect(screen.getByText('La eliminación está en proceso.')).toBeTruthy();
  expect(screen.getByLabelText('Volver al inicio')).toBeTruthy();
});
test('a status failure requires retry and never shows a destructive action', async () => {
  install();
  const original = jest.mocked(fetch).getMockImplementation()!;
  jest
    .mocked(fetch)
    .mockImplementation((input, init) =>
      new URL(String(input)).pathname === '/account-deletion/me'
        ? Promise.resolve(jsonResponse({ message: 'Unavailable' }, 503))
        : original(input, init),
    );
  await render(<Connected />);
  await act(async () => undefined);
  expect(
    await screen.findByText('No pudimos comprobar tu cuenta. Reintenta antes de continuar.'),
  ).toBeTruthy();
  expect(screen.queryByLabelText('Enviar código para eliminar mi cuenta')).toBeNull();
});

test('sending the email only opens verification; incomplete codes and cancel never confirm deletion', async () => {
  const requests = install();
  await render(<Connected />);
  await fireEvent.press(await screen.findByLabelText('Enviar código para eliminar mi cuenta'));
  expect(await screen.findByText('Verifica tu correo')).toBeTruthy();
  expect(screen.getByText(AUTH_ACCOUNT.correo)).toBeTruthy();
  expect(requests).toEqual(['request']);
  const confirmButton = screen.getByLabelText('Confirmar eliminación definitiva');
  expect(confirmButton).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Código de verificación de 8 dígitos'), '1234');
  expect(confirmButton).toBeDisabled();
  await fireEvent.press(screen.getByLabelText('Conservar mi cuenta'));
  expect(mockRouter.replace).toHaveBeenCalledWith('/perfil');
  expect(controls.status).toBe('authenticated');
  expect(requests).toEqual(['request']);
});

test('an email delivery failure leaves the account intact and does not open verification', async () => {
  install();
  const original = jest.mocked(fetch).getMockImplementation()!;
  jest
    .mocked(fetch)
    .mockImplementation((input, init) =>
      new URL(String(input)).pathname === '/account-deletion/request'
        ? Promise.resolve(
            jsonResponse({ message: 'No pudimos enviar el código. Intenta más tarde.' }, 503),
          )
        : original(input, init),
    );
  await render(<Connected />);
  await fireEvent.press(await screen.findByLabelText('Enviar código para eliminar mi cuenta'));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByLabelText('Código de verificación de 8 dígitos')).toBeNull();
  expect(controls.status).toBe('authenticated');
});
