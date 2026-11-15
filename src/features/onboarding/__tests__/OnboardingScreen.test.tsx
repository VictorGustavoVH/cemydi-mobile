import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { render } from '../../../../tests/support/render-with-toast';
import { OnboardingScreen } from '../OnboardingScreen';
import { completeOnboarding } from '../onboarding-progress';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  impactAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
}));
jest.mock('../onboarding-progress', () => ({ completeOnboarding: jest.fn(async () => undefined) }));

beforeEach(() => {
  mockReplace.mockClear();
  jest.mocked(completeOnboarding).mockReset().mockResolvedValue(undefined);
});

it('recorre las tres pantallas y abre Inicio sin exigir sesión', async () => {
  await render(<OnboardingScreen />);
  await fireEvent.press(screen.getByLabelText('Ir a la siguiente pantalla'));
  expect(screen.getByLabelText('Ir a pantalla 2 de 3')).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ selected: true }),
  );
  await fireEvent.press(screen.getByLabelText('Ir a la siguiente pantalla'));
  expect(screen.getByLabelText('Ir a pantalla 3 de 3')).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ selected: true }),
  );
  await fireEvent.press(screen.getByLabelText('Explorar catálogo sin iniciar sesión'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/inicio'));
  expect(completeOnboarding).toHaveBeenCalledTimes(1);
});
it('permite omitir la introducción', async () => {
  await render(<OnboardingScreen />);
  await fireEvent.press(screen.getByLabelText('Omitir introducción y explorar catálogo'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/inicio'));
  expect(completeOnboarding).toHaveBeenCalledTimes(1);
});
it('ofrece el login opcional en la última pantalla', async () => {
  await render(<OnboardingScreen />);
  expect(screen.queryByLabelText('Inicia sesión')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Ir a pantalla 3 de 3'));
  await fireEvent.press(screen.getByLabelText('Inicia sesión'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  expect(completeOnboarding).toHaveBeenCalledTimes(1);
});

it('espera a guardar antes de navegar y bloquea toques repetidos', async () => {
  let resolveSave: () => void = () => undefined;
  jest
    .mocked(completeOnboarding)
    .mockImplementationOnce(() => new Promise<void>((resolve) => (resolveSave = resolve)));
  await render(<OnboardingScreen />);
  await fireEvent.press(screen.getByLabelText('Omitir introducción y explorar catálogo'));
  expect(mockReplace).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(screen.getByLabelText('Omitir introducción y explorar catálogo')).toBeDisabled(),
  );
  await act(async () => resolveSave());
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/inicio'));
  expect(completeOnboarding).toHaveBeenCalledTimes(1);
});

it('muestra un error si falla el guardado y permite reintentar sin navegar antes', async () => {
  jest.mocked(completeOnboarding).mockRejectedValueOnce(new Error('Almacenamiento no disponible'));
  await render(<OnboardingScreen />);
  await fireEvent.press(screen.getByLabelText('Omitir introducción y explorar catálogo'));
  await screen.findByText('No pudimos guardar tu progreso. Intenta de nuevo.');
  expect(mockReplace).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Omitir introducción y explorar catálogo'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/inicio'));
  expect(completeOnboarding).toHaveBeenCalledTimes(2);
});
