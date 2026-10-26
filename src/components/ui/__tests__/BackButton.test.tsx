import { fireEvent, render, screen } from '@testing-library/react-native';
import { BackButton } from '../BackButton';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    canGoBack: mockCanGoBack,
    replace: mockReplace,
    push: jest.fn(),
  }),
}));

describe('BackButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack.mockReturnValue(true);
  });

  it('renderiza accesible con rol button y etiqueta por defecto', async () => {
    await render(<BackButton />);
    const button = screen.getByRole('button', { name: 'Volver' });
    expect(button).toBeTruthy();
  });

  it('ejecuta onPress prioritariamente si se especifica', async () => {
    const customOnPress = jest.fn();
    await render(<BackButton onPress={customOnPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(customOnPress).toHaveBeenCalledTimes(1);
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('ejecuta router.back() cuando canGoBack es true y no se provee onPress', async () => {
    mockCanGoBack.mockReturnValue(true);
    await render(<BackButton fallbackHref="/inicio" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('ejecuta router.replace con fallbackHref si canGoBack es false', async () => {
    mockCanGoBack.mockReturnValue(false);
    await render(<BackButton fallbackHref="/inicio" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(mockReplace).toHaveBeenCalledWith('/inicio');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('ejecuta router.back() si canGoBack es false pero no hay fallbackHref', async () => {
    mockCanGoBack.mockReturnValue(false);
    await render(<BackButton />);
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('respeta la propiedad disabled bloqueando las pulsaciones', async () => {
    const customOnPress = jest.fn();
    await render(<BackButton disabled onPress={customOnPress} />);
    const button = screen.getByRole('button', { name: 'Volver', disabled: true });
    expect(button).toBeTruthy();
    await fireEvent.press(button);
    expect(customOnPress).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('permite personalizar accessibilityLabel y testID', async () => {
    await render(<BackButton accessibilityLabel="Regresar al listado" testID="custom-back-btn" />);
    expect(screen.getByTestId('custom-back-btn')).toBeTruthy();
    expect(screen.getByLabelText('Regresar al listado')).toBeTruthy();
  });
});
