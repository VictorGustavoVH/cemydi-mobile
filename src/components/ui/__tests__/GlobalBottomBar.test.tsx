import { fireEvent, screen } from '@testing-library/react-native';
import { render } from '../../../../tests/support/render-with-toast';
import { GlobalBottomBar } from '../GlobalBottomBar';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() };
const mockRequestAccess = jest.fn(() => false);
let mockPathname = '/inicio';

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname,
}));

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn().mockResolvedValue(undefined) }));

jest.mock('@/providers/cart-provider', () => ({
  useCartCount: () => 3,
}));

jest.mock('@/hooks/useAccountAccess', () => ({
  useAccountAccess: () => ({ user: null, requestAccess: mockRequestAccess }),
}));

describe('GlobalBottomBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/inicio';
    mockRequestAccess.mockReturnValue(false);
  });

  it('muestra el contador del carrito en el badge', async () => {
    await render(<GlobalBottomBar />);
    expect(screen.getByLabelText('Carrito, 3 unidades')).toBeTruthy();
  });

  it('ignora un doble toque rápido para no apilar navegaciones', async () => {
    await render(<GlobalBottomBar />);
    const cart = screen.getByLabelText('Carrito, 3 unidades');
    await fireEvent.press(cart);
    await fireEvent.press(cart);
    expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
  });

  it('explorar abre el catálogo completo', async () => {
    await render(<GlobalBottomBar />);
    await fireEvent.press(screen.getByRole('button', { name: 'Explorar' }));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/catalogo');
  });

  it('no se renderiza fuera de las pestañas principales', async () => {
    mockPathname = '/producto/123';
    await render(<GlobalBottomBar />);
    expect(screen.queryByLabelText('Carrito, 3 unidades')).toBeNull();
  });
  it('marca Perfil como seleccionado y oculta la barra en sus subrutas', async () => {
    mockPathname = '/perfil';
    const view = await render(<GlobalBottomBar />);
    expect(screen.getByLabelText('Perfil')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
    mockPathname = '/perfil/notificaciones';
    await view.rerender(<GlobalBottomBar />);
    expect(screen.queryByLabelText('Perfil')).toBeNull();
  });
});

it('abre el perfil conectado al autorizar el acceso', async () => {
  jest.clearAllMocks();
  mockPathname = '/inicio';
  mockRequestAccess.mockReturnValue(true);
  await render(<GlobalBottomBar />);
  await fireEvent.press(screen.getByRole('button', { name: 'Perfil' }));
  expect(mockRequestAccess).toHaveBeenCalledWith('/perfil');
  expect(mockRouter.navigate).toHaveBeenCalledWith('/perfil');
  expect(screen.queryByText('Tu perfil')).toBeNull();
});
