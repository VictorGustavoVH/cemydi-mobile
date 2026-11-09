import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { createContext } from 'react';
import { AppState, Platform, Text } from 'react-native';
import { allowScreenCaptureAsync, preventScreenCaptureAsync } from 'expo-screen-capture';
import { render } from '../../../../tests/support/render-with-toast';
import { CredentialScreenProtection } from '../CredentialScreenProtection';

const mockFocusContext = createContext(true);
jest.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => false, replace: jest.fn() }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useContext, useEffect } = jest.requireActual<typeof import('react')>('react');
    const focused = useContext(mockFocusContext);
    useEffect(() => (focused ? callback() : undefined), [callback, focused]);
  },
}));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const content = (
  <CredentialScreenProtection>
    <Text>Credenciales de prueba</Text>
  </CredentialScreenProtection>
);

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.mocked(preventScreenCaptureAsync).mockReset().mockResolvedValue(undefined);
  jest.mocked(allowScreenCaptureAsync).mockReset().mockResolvedValue(undefined);
});

it('espera la confirmación nativa antes de mostrar credenciales', async () => {
  const pending = deferred();
  jest.mocked(preventScreenCaptureAsync).mockReturnValueOnce(pending.promise);
  await render(content);
  expect(screen.queryByText('Credenciales de prueba')).toBeNull();
  expect(screen.getByText('Preparando acceso seguro…')).toBeTruthy();
  await act(async () => pending.resolve());
  expect(screen.getByText('Credenciales de prueba')).toBeTruthy();
  expect(allowScreenCaptureAsync).not.toHaveBeenCalled();
});

it('conserva el bloqueo durante segundo plano y al volver a la misma pantalla', async () => {
  const listeners = jest.spyOn(AppState, 'addEventListener');
  await render(content);
  await act(async () => {
    listeners.mock.calls.forEach(([, callback]) => callback('background'));
  });
  expect(allowScreenCaptureAsync).not.toHaveBeenCalled();
  await act(async () => {
    listeners.mock.calls.forEach(([, callback]) => callback('active'));
  });
  expect(screen.getByText('Credenciales de prueba')).toBeTruthy();
  expect(allowScreenCaptureAsync).not.toHaveBeenCalled();
});

it('oculta credenciales ante fallos y permite reintentar con otra clave', async () => {
  jest.mocked(preventScreenCaptureAsync).mockRejectedValueOnce(new Error('No activity'));
  await render(content);
  expect(screen.queryByText('Credenciales de prueba')).toBeNull();
  expect(screen.getByText('No pudimos proteger esta pantalla')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
  await waitFor(() => expect(screen.getByText('Credenciales de prueba')).toBeTruthy());
  const keys = jest.mocked(preventScreenCaptureAsync).mock.calls.map(([key]) => key);
  expect(new Set(keys).size).toBe(2);
  expect(allowScreenCaptureAsync).toHaveBeenCalledWith(keys[0]);
});

it('libera al perder foco aunque siga montada y vuelve a proteger al regresar', async () => {
  const view = await render(<mockFocusContext.Provider value>{content}</mockFocusContext.Provider>);
  const firstKey = jest.mocked(preventScreenCaptureAsync).mock.calls[0][0];
  await view.rerender(
    <mockFocusContext.Provider value={false}>{content}</mockFocusContext.Provider>,
  );
  expect(screen.queryByText('Credenciales de prueba')).toBeNull();
  expect(allowScreenCaptureAsync).toHaveBeenCalledWith(firstKey);
  await view.rerender(<mockFocusContext.Provider value>{content}</mockFocusContext.Provider>);
  await waitFor(() => expect(screen.getByText('Credenciales de prueba')).toBeTruthy());
  expect(preventScreenCaptureAsync).toHaveBeenCalledTimes(2);
  expect(jest.mocked(preventScreenCaptureAsync).mock.calls[1][0]).not.toBe(firstKey);
});

it('espera una activación pendiente antes de liberar una pantalla desmontada', async () => {
  const pending = deferred();
  jest.mocked(preventScreenCaptureAsync).mockReturnValueOnce(pending.promise);
  const view = await render(content);
  await view.unmount();
  expect(allowScreenCaptureAsync).not.toHaveBeenCalled();
  await act(async () => pending.resolve());
  expect(allowScreenCaptureAsync).toHaveBeenCalledWith(
    jest.mocked(preventScreenCaptureAsync).mock.calls[0][0],
  );
});

it('cada pantalla libera solo su propia clave y tolera un fallo al liberar', async () => {
  const view = await render(
    <>
      {content}
      {content}
    </>,
  );
  const keys = jest.mocked(preventScreenCaptureAsync).mock.calls.map(([key]) => key);
  expect(new Set(keys).size).toBe(2);
  jest.mocked(allowScreenCaptureAsync).mockRejectedValueOnce(new Error('Activity destroyed'));
  await view.unmount();
  expect(jest.mocked(allowScreenCaptureAsync).mock.calls.map(([key]) => key)).toEqual(keys);
});

it('mantiene iOS fuera del alcance de la protección Android', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  await render(content);
  expect(screen.getByText('Credenciales de prueba')).toBeTruthy();
  expect(preventScreenCaptureAsync).not.toHaveBeenCalled();
  expect(allowScreenCaptureAsync).not.toHaveBeenCalled();
});
