import { AUTH_ACCOUNT as DEFAULT_ACCOUNT, installAuthApiMock } from '../support/auth-api-mock';
import { useEffect } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { render } from '../support/render-with-toast';
import { installNetworkMock } from '../support/network-mock';
import { useCatalogPreview } from '@/providers/catalog-preview-provider';
import { CatalogPreviewProvider } from '../support/catalog-cart-provider';
import { CartPreviewScreen } from '@/features/cart/CartPreviewScreen';
import { HomeScreen } from '@/features/home/HomeScreen';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { installHomePreviewApiMock } from '../support/home-preview-api-mock';
import { CART_LINE, installCartApiMock } from '../support/cart-api-mock';
import { toCartEntry } from '@/features/cart/services/cart-adapter';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: () => true,
  navigate: jest.fn(),
  setParams: jest.fn(),
  canDismiss: () => false,
  dismiss: jest.fn(),
};
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useEffect } = require('react');
  return {
    useRouter: () => mockRouter,
    usePathname: () => '/perfil',
    useLocalSearchParams: () => ({}),
    useFocusEffect: (callback: () => void | (() => void)) => useEffect(callback, [callback]),
  };
});
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn().mockResolvedValue(undefined) }));

function SeedCart() {
  const { addItem, updateQuantity } = useCatalogPreview();
  useEffect(() => {
    addItem('101', 'purchase', toCartEntry(CART_LINE).product);
    updateQuantity('101', 'purchase', 2);
    // Seed only once; session state survives navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <CartPreviewScreen />;
}

describe('Acceso como invitado', () => {
  beforeEach(() => {
    installNetworkMock();
    installAuthApiMock();
    installHomePreviewApiMock();
    installCartApiMock();
  });

  it('permite explorar el catálogo y solicita sesión al abrir Perfil', async () => {
    await render(
      <CatalogPreviewProvider>
        <HomeScreen />
      </CatalogPreviewProvider>,
    );
    expect(await screen.findByText('Para tu bienestar')).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
    await fireEvent.press(screen.getAllByLabelText('Perfil')[0]);
    expect(mockRouter.push).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Inicia sesión para continuar')).toBeNull();
  });

  it('pide acceso al revisar el carrito y vuelve conservando productos y cantidades', async () => {
    const view = await render(
      <CatalogPreviewProvider>
        <SeedCart />
      </CatalogPreviewProvider>,
    );
    await fireEvent.press(screen.getByLabelText('Revisar carrito'));
    expect(mockRouter.push).toHaveBeenCalledWith('/login');
    expect(screen.getByText('Inicia sesión para continuar')).toBeTruthy();
    expect(screen.queryByLabelText('Cerrar')).toBeNull();
    await view.rerender(
      <CatalogPreviewProvider>
        <LoginScreen />
      </CatalogPreviewProvider>,
    );
    await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'cliente@cemydi.test');
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), DEFAULT_ACCOUNT.password);
    await fireEvent.press(screen.getByLabelText('Iniciar sesión'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/carrito'));
    await view.rerender(
      <CatalogPreviewProvider>
        <CartPreviewScreen />
      </CatalogPreviewProvider>,
    );
    expect(await screen.findByLabelText('Cantidad de Silla de ruedas, compra: 2')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Guardar productos de invitado'));
    expect(await screen.findByLabelText('Cantidad de Silla de ruedas, compra: 4')).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByLabelText('Guardar productos de invitado')).toBeNull(),
    );
    await fireEvent.press(screen.getByLabelText('Revisar carrito'));
    expect(screen.getByLabelText('Cerrar')).toBeTruthy();
  });
});
