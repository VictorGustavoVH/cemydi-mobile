import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { CatalogPreviewProvider } from '@/providers/catalog-preview-provider';
import { HomeScreen } from '@/features/home/HomeScreen';
import { ProductDetailScreen } from '@/features/products/ProductDetailScreen';
import { CartPreviewScreen } from '@/features/cart/CartPreviewScreen';
import { homeServiceMock } from '@/features/home/services/homeService.mock';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn().mockResolvedValue(undefined) }));

describe('Catálogo, detalle y carrito con estado de sesión compartido', () => {
  it('busca sin acentos, navega con modalidad y conserva carrito y favoritos entre pantallas', async () => {
    const view = await render(
      <CatalogPreviewProvider>
        <HomeScreen />
      </CatalogPreviewProvider>,
    );
    await screen.findByText('Para tu bienestar');
    await fireEvent.changeText(screen.getByLabelText('Buscar equipo ortopédico'), ' SILLA ');
    await fireEvent.press(screen.getByRole('button', { name: 'Renta' }));
    expect(screen.getByText('1 producto de muestra')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Silla de ruedas.*Ver producto/ }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/producto/[id]',
      params: { id: 'wheelchair', mode: 'rental' },
    });

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

  it('combina búsqueda, categorías y modalidad y recupera una búsqueda vacía', async () => {
    await render(
      <CatalogPreviewProvider>
        <HomeScreen />
      </CatalogPreviewProvider>,
    );
    await screen.findByText('Para tu bienestar');
    await fireEvent.changeText(screen.getByLabelText('Buscar equipo ortopédico'), 'oxigeno');
    expect(screen.getByText('Concentrador de oxígeno')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Compra' }));
    expect(screen.getByText('No encontramos productos')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Movilidad' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Renta' }));
    expect(screen.getByText('1 producto de muestra · Movilidad')).toBeTruthy();
    expect(screen.getByText('Silla de ruedas')).toBeTruthy();
    expect(screen.queryByText('Muletas ajustables')).toBeNull();
  });

  it('muestra loading y error del servicio, y reintenta con el servicio existente', async () => {
    let reject!: (error: Error) => void;
    const service = jest.spyOn(homeServiceMock, 'getHome').mockReturnValueOnce(
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
    await act(() => reject(new Error('Catálogo no disponible')));
    await waitFor(() => expect(screen.getByText('Catálogo no disponible')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('Para tu bienestar');
    expect(service).toHaveBeenCalledTimes(2);
  });
});
