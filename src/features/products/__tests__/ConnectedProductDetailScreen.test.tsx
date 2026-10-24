import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { QueryClient } from '@tanstack/react-query';
import { render } from '../../../../tests/support/render-with-toast';
import { installNetworkMock } from '../../../../tests/support/network-mock';
import {
  productFixture,
  productOfferFixture,
  productPage,
} from '../../../../tests/support/product-fixtures';
import { emptyProductFilters, productService } from '@/services/products/product-service';
import { productDetailKey } from '@/services/products/product-cache';
import { CatalogPreviewProvider } from '@/providers/catalog-preview-provider';
import { ApiError } from '@/services/http/api-error';
import { ConnectedProductDetailScreen } from '../ConnectedProductDetailScreen';
import { CartPreviewScreen } from '@/features/cart/CartPreviewScreen';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));

describe('Detalle público conectado', () => {
  beforeEach(() => {
    installNetworkMock();
    jest.spyOn(productService, 'offers').mockResolvedValue({ promotions: [] });
    jest
      .spyOn(productService, 'reviews')
      .mockResolvedValue({ reviews: [], summary: { count: 0, averageRating: 0 } });
    jest.spyOn(productService, 'recommendations').mockResolvedValue({ recommendations: [] });
  });
  it('muestra información real y bloquea añadir productos agotados', async () => {
    jest
      .spyOn(productService, 'detail')
      .mockResolvedValue({ product: productFixture(1, { stock: 0, requiereReceta: true }) });
    await render(
      <CatalogPreviewProvider>
        <ConnectedProductDetailScreen productId="1" initialMode="rental" />
      </CatalogPreviewProvider>,
    );
    await screen.findByText('Producto 1');
    expect(screen.getByText('No disponible')).toBeTruthy();
    expect(screen.getByText('$60.00')).toBeTruthy();
    expect(screen.getByText('Condiciones de renta.')).toBeTruthy();
    expect(screen.getByLabelText('Añadir renta al carrito')).toBeDisabled();
    expect(screen.getByLabelText('Ver carrito')).toBeTruthy();
    expect(screen.queryByText('Cliente A')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Características' }));
    expect(screen.getByText('Modelo de prueba')).toBeTruthy();
  });
  it('recupera reseñas reales, recomendaciones y carrito temporal con toast y deshacer', async () => {
    jest.spyOn(productService, 'detail').mockResolvedValue({ product: productFixture(1) });
    jest.spyOn(productService, 'reviews').mockResolvedValue({
      reviews: [1, 2, 3].map((id) => ({
        id,
        rating: 5,
        comment: `Opinión real ${id}`,
        createdAt: '2026-10-08T00:00:00.000Z',
        user: { id, nombre: `Persona ${id}` },
      })),
      summary: { count: 3, averageRating: 5 },
    });
    jest
      .spyOn(productService, 'recommendations')
      .mockResolvedValue({ recommendations: [productFixture(2)] });
    const view = await render(
      <CatalogPreviewProvider>
        <ConnectedProductDetailScreen productId="1" />
      </CatalogPreviewProvider>,
    );
    await screen.findByText('Opinión real 1');
    await screen.findByText('Producto 2');
    expect(screen.queryByText('Opinión real 3')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Ver más reseñas'));
    expect(screen.getByText('Opinión real 3')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Guardar en favoritos'));
    expect(screen.getByText('Guardado en favoritos durante esta sesión.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Añadir al carrito'));
    expect(screen.getByText('Producto agregado')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Renta'));
    await fireEvent.press(screen.getByLabelText('Añadir renta al carrito'));
    await view.rerender(
      <CatalogPreviewProvider>
        <CartPreviewScreen />
      </CatalogPreviewProvider>,
    );
    expect(screen.getByLabelText('Cantidad de Producto 1, compra: 1')).toBeTruthy();
    expect(screen.getByLabelText('Cantidad de Producto 1, renta: 1')).toBeTruthy();
    expect(screen.getByText(/Carrito temporal de esta sesión/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Eliminar Producto 1, compra'));
    expect(screen.queryByLabelText('Cantidad de Producto 1, compra: 1')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Deshacer eliminación del producto'));
    expect(screen.getByLabelText('Cantidad de Producto 1, compra: 1')).toBeTruthy();
    expect(screen.getByText('Producto restaurado')).toBeTruthy();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });
  it('permite reintentar reseñas sin perder el producto ni las recomendaciones', async () => {
    jest.spyOn(productService, 'detail').mockResolvedValue({ product: productFixture(1) });
    jest
      .spyOn(productService, 'reviews')
      .mockRejectedValueOnce(new ApiError('Sin red', { kind: 'network' }));
    jest
      .spyOn(productService, 'recommendations')
      .mockResolvedValue({ recommendations: [productFixture(2)] });
    await render(
      <CatalogPreviewProvider>
        <ConnectedProductDetailScreen productId="1" />
      </CatalogPreviewProvider>,
    );
    await screen.findByText('No pudimos consultar las reseñas.');
    expect(screen.getByText('Producto 1')).toBeTruthy();
    await screen.findByText('Producto 2');
    await fireEvent.press(screen.getByLabelText('Reintentar'));
    await waitFor(() => expect(screen.getByText('Todavía no hay reseñas')).toBeTruthy());
  });
  it('maneja un producto que dejó de publicarse', async () => {
    jest
      .spyOn(productService, 'detail')
      .mockRejectedValue(new ApiError('Producto no encontrado', { kind: 'http', status: 404 }));
    await render(
      <CatalogPreviewProvider>
        <ConnectedProductDetailScreen productId="999" />
      </CatalogPreviewProvider>,
    );
    await screen.findByText('Producto no disponible');
  });

  it('muestra los iconos del encabezado antes de cargar el detalle', async () => {
    let resolveDetail!: (value: Awaited<ReturnType<typeof productService.detail>>) => void;
    jest.spyOn(productService, 'detail').mockReturnValue(
      new Promise((resolve) => {
        resolveDetail = resolve;
      }),
    );
    await render(
      <CatalogPreviewProvider>
        <ConnectedProductDetailScreen productId="1" />
      </CatalogPreviewProvider>,
    );
    expect(screen.getByLabelText('Cargando producto…')).toBeTruthy();
    expect(screen.getByLabelText('Volver')).toBeTruthy();
    expect(screen.getByLabelText('Guardar en favoritos')).toBeTruthy();
    expect(screen.getByLabelText('Compartir producto')).toBeDisabled();
    await act(async () => {
      resolveDetail({ product: productFixture(1) });
    });
  });

  it('espera las ofertas antes de pintar el precio para no desplazar la ficha', async () => {
    let resolveOffers!: (value: Awaited<ReturnType<typeof productService.offers>>) => void;
    jest.spyOn(productService, 'offers').mockReturnValue(
      new Promise((done) => {
        resolveOffers = done;
      }),
    );
    jest.spyOn(productService, 'detail').mockResolvedValue({ product: productFixture(1) });
    await render(
      <CatalogPreviewProvider>
        <ConnectedProductDetailScreen productId="1" />
      </CatalogPreviewProvider>,
    );
    expect(await screen.findByLabelText('Cargando producto…')).toBeTruthy();
    expect(screen.queryByText('Producto 1')).toBeNull();
    await act(() => resolveOffers({ promotions: [productOfferFixture(1)] }));
    expect(await screen.findByText('Producto 1')).toBeTruthy();
    expect(screen.getByText('Oferta · 25%')).toBeTruthy();
  });

  it('pinta la ficha desde el primer frame cuando Inicio ya dejó el producto listo', async () => {
    jest.spyOn(productService, 'detail').mockResolvedValue({ product: productFixture(1) });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    // Escenario real: Inicio ya resolvió el producto y las promociones.
    client.setQueryData(productDetailKey(1), { product: productFixture(1) });
    client.setQueryData(['promotions', 'active'], { promotions: [] });
    await render(
      <CatalogPreviewProvider>
        <ConnectedProductDetailScreen productId="1" />
      </CatalogPreviewProvider>,
      { client },
    );
    // Sin skeleton no hay estructura que reemplazar: nada se reacomoda después.
    expect(screen.queryByLabelText('Cargando producto…')).toBeNull();
    expect(screen.getByText('Producto 1')).toBeTruthy();
    expect(screen.getByLabelText('Añadir al carrito')).toBeTruthy();
  });

  it.each(['list', 'recommendations'] as const)(
    'refresca disponibilidad antigua recuperada desde %s',
    async (source) => {
      let finish!: (value: Awaited<ReturnType<typeof productService.detail>>) => void;
      const detail = jest.spyOn(productService, 'detail').mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Infinity } },
      });
      const old = productFixture(1, { nombre: 'Equipo en caché', stock: 3 });
      const key =
        source === 'list'
          ? ['products', 'list', emptyProductFilters]
          : ['products', 'recommendations', '2'];
      client.setQueryData(
        key,
        source === 'list'
          ? { pages: [{ ...productPage(1, 1), products: [old] }], pageParams: [1] }
          : { recommendations: [old] },
        { updatedAt: Date.now() - 60_000 },
      );
      client.setQueryData(['promotions', 'active'], { promotions: [] });
      await render(
        <CatalogPreviewProvider>
          <ConnectedProductDetailScreen productId="1" />
        </CatalogPreviewProvider>,
        { client },
      );
      expect(screen.getByText('Equipo en caché')).toBeTruthy();
      await waitFor(() => expect(detail).toHaveBeenCalledTimes(1));
      await act(() => finish({ product: productFixture(1, { stock: 0 }) }));
      await screen.findByText('Producto 1');
      expect(screen.getByLabelText('Añadir al carrito')).toBeDisabled();
    },
  );
});
