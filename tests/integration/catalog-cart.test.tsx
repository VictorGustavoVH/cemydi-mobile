import { UserFacingError } from '@/services/http/api-error';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { render } from '../support/render-with-toast';
import { installNetworkMock } from '../support/network-mock';
import { CatalogPreviewProvider } from '@/providers/catalog-preview-provider';
import { HomeScreen } from '@/features/home/HomeScreen';
import { ProductDetailScreen } from '@/features/products/ProductDetailScreen';
import { CartPreviewScreen } from '@/features/cart/CartPreviewScreen';
import { homeService } from '@/features/home/services/homeService.api';
import { installHomePreviewApiMock } from '../support/home-preview-api-mock';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({}),
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn().mockResolvedValue(undefined) }));

describe('Catálogo, detalle y carrito con estado de sesión compartido', () => {
  beforeEach(() => {
    installNetworkMock();
    installHomePreviewApiMock();
  });

  it('conserva carrito y favoritos de muestra entre pantallas aisladas del catálogo real', async () => {
    const view = await render(
      <CatalogPreviewProvider>
        <ProductDetailScreen productId="wheelchair" initialMode="rental" />
      </CatalogPreviewProvider>,
    );
    // Simulate the route rendering its destination while keeping the real provider mounted.
    await view.rerender(
      <CatalogPreviewProvider>
        <ProductDetailScreen productId="wheelchair" initialMode="rental" />
      </CatalogPreviewProvider>,
    );
    await fireEvent.press(screen.getByLabelText('Guardar en favoritos'));
    await fireEvent.press(screen.getByLabelText('Añadir renta al carrito'));
    await fireEvent.press(screen.getByLabelText('Ver carrito (1)'));
    expect(mockPush).toHaveBeenLastCalledWith('/carrito');
    await view.rerender(
      <CatalogPreviewProvider>
        <CartPreviewScreen />
      </CatalogPreviewProvider>,
    );
    expect(screen.getByLabelText('Cantidad de Silla de ruedas, renta: 1')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Aumentar cantidad de Silla de ruedas, renta'));
    await fireEvent.press(screen.getByLabelText('Ver Silla de ruedas, renta'));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/producto/[id]',
      params: { id: 'wheelchair', mode: 'rental' },
    });
    await view.rerender(
      <CatalogPreviewProvider>
        <ProductDetailScreen productId="wheelchair" initialMode="rental" />
      </CatalogPreviewProvider>,
    );
    expect(screen.getByLabelText('Quitar de favoritos')).toBeTruthy();
    expect(screen.getByLabelText('Ver carrito (2)')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('envía búsqueda, categorías y modalidad desde Home al catálogo completo', async () => {
    await render(
      <CatalogPreviewProvider>
        <HomeScreen />
      </CatalogPreviewProvider>,
    );
    await screen.findByText('Ver catálogo completo');
    await fireEvent.changeText(screen.getByLabelText('Buscar equipo ortopédico'), 'oxigeno');
    await fireEvent(screen.getByLabelText('Buscar equipo ortopédico'), 'submitEditing');
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/catalogo',
      params: { search: 'oxigeno' },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Compra' }));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/catalogo',
      params: { mode: 'purchase' },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Movilidad' }));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/catalogo',
      params: { search: 'Movilidad' },
    });
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /Ver producto$/ })).toHaveLength(6),
    );
  });

  it('muestra loading y error del servicio, y reintenta con el servicio existente', async () => {
    let reject!: (error: Error) => void;
    const service = jest.spyOn(homeService, 'getHome').mockReturnValueOnce(
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
    );
    await render(
      <CatalogPreviewProvider>
        <HomeScreen />
      </CatalogPreviewProvider>,
    );
    expect(screen.getByLabelText('Cargando catálogo…')).toBeTruthy();
    expect(screen.getByLabelText('Buscar equipo ortopédico')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeTruthy();
    expect(screen.queryByText('No encontramos productos')).toBeNull();
    expect(screen.getByText('Para tu bienestar')).toBeTruthy();
    expect(screen.getByText('Categorías')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Descanso' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver banner 1 de 3' })).toBeTruthy();
    await act(() => reject(new UserFacingError('Catálogo no disponible')));
    await waitFor(() => expect(screen.getByText('Catálogo no disponible')).toBeTruthy());
    expect(screen.getByText('Categorías')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver banner 1 de 3' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('Ver catálogo completo');
    expect(service).toHaveBeenCalledTimes(2);
  });
});
