import { fireEvent, screen } from '@testing-library/react-native';
import { render } from '../../../../tests/support/render-with-toast';
import { OnboardingScreen } from '../OnboardingScreen';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  impactAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
}));
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
  expect(mockReplace).toHaveBeenCalledWith('/inicio');
});
it('permite omitir la introducción', async () => {
  await render(<OnboardingScreen />);
  await fireEvent.press(screen.getByLabelText('Omitir introducción y explorar catálogo'));
  expect(mockReplace).toHaveBeenCalledWith('/inicio');
});
it('ofrece el login opcional en la última pantalla', async () => {
  await render(<OnboardingScreen />);
  expect(screen.queryByLabelText('Inicia sesión')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Ir a pantalla 3 de 3'));
  await fireEvent.press(screen.getByLabelText('Inicia sesión'));
  expect(mockReplace).toHaveBeenCalledWith('/login');
});
