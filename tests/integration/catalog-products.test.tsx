import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { render } from '../support/render-with-toast';
import { installNetworkMock } from '../support/network-mock';
import { productFixture, productOfferFixture, productPage } from '../support/product-fixtures';
import { CatalogPreviewProvider } from '../support/catalog-cart-provider';
import { HomeScreen } from '@/features/home/HomeScreen';
import { CatalogScreen } from '@/features/catalog/CatalogScreen';
import { ConnectedProductDetailScreen } from '@/features/products/ConnectedProductDetailScreen';

let mockParams: Record<string, string> = {};
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
  useRouter: () => ({
    navigate: mockPush,
    push: mockPush,
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  }),
}));

it('conecta Inicio, búsqueda, filtros y detalle usando contratos HTTP y caché reales', async () => {
  installNetworkMock();
  mockParams = {};
  const requests: URL[] = [];
  const product = productFixture(1, { nombre: 'Silla real' });
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    let body: unknown;
    if (url.pathname === '/products') {
      const home = url.searchParams.get('pageSize') === '6';
      body = home ? productPage(1, 6, 6) : { ...productPage(1, 1), products: [product] };
    } else if (url.pathname === '/promotions') {
      body = { promotions: [productOfferFixture(1)] };
    } else if (/^\/reviews\/product\/\d+$/.test(url.pathname)) {
      body = { reviews: [], summary: { count: 0, averageRating: 0 } };
    } else if (url.pathname === '/products/1/recommendations') {
      body = { recommendations: [] };
    } else {
      throw new Error(`Petición inesperada: ${url.pathname}`);
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  const view = await render(
    <CatalogPreviewProvider>
      <HomeScreen />
    </CatalogPreviewProvider>,
  );
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: /Ver producto$/ })).toHaveLength(6),
  );
  await fireEvent.changeText(screen.getByLabelText('Buscar equipo ortopédico'), 'silla');
  await fireEvent(screen.getByLabelText('Buscar equipo ortopédico'), 'submitEditing');
  expect(mockPush).toHaveBeenLastCalledWith({
    pathname: '/catalogo',
    params: { search: 'silla', t: expect.any(String) },
  });

  mockParams = { search: 'silla' };
  await view.rerender(
    <CatalogPreviewProvider>
      <CatalogScreen />
    </CatalogPreviewProvider>,
  );
  await screen.findByText('Silla real');
  await fireEvent.press(screen.getByRole('radio', { name: 'Compra' }));
  await waitFor(() =>
    expect(
      requests.some(
        (url) =>
          url.pathname === '/products' &&
          url.searchParams.get('search') === 'silla' &&
          url.searchParams.get('tipos') === 'MIXTO,VENTA',
      ),
    ).toBe(true),
  );
  await fireEvent.press(
    await screen.findByRole('button', { name: /^Silla real\..*Ver producto$/ }),
  );
  expect(mockPush).toHaveBeenLastCalledWith({
    pathname: '/producto/[id]',
    params: { id: '1', mode: undefined },
  });
  await view.rerender(
    <CatalogPreviewProvider>
      <ConnectedProductDetailScreen productId="1" />
    </CatalogPreviewProvider>,
  );
  expect(screen.getByText('Silla real')).toBeTruthy();
  expect(screen.queryByLabelText('Cargando producto…')).toBeNull();
  expect(screen.getByText('$900.00')).toBeTruthy();
  await screen.findByText('Todavía no hay reseñas');
  expect(requests.filter((url) => url.pathname === '/products/1')).toHaveLength(0);
  expect(fetch).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ credentials: 'omit' }),
  );
});
