import { httpClient } from '@/services/http/client';
import { ApiError } from '@/services/http/api-error';
import {
  productFixture,
  productPage,
  productReviewPage,
} from '../../../../tests/support/product-fixtures';
import { homeService } from '@/features/home/services/homeService.api';
import { emptyProductFilters, productService } from '../product-service';
import { toProductCard, toProductDetail } from '../product-adapter';
import { jsonResponse } from '../../../../tests/support/auth-api-mock';

const emptyReviewPage = {
  reviews: [],
  summary: { count: 0, averageRating: 0 },
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

describe('Contratos públicos del catálogo', () => {
  it('solicita la página de reseñas indicada con tamaño acotado y AbortSignal', async () => {
    const request = jest.spyOn(httpClient, 'request').mockResolvedValueOnce(productReviewPage(2));
    const signal = new AbortController().signal;
    const result = await productService.reviews('101', signal, 2);
    expect(result.reviews).toHaveLength(2);
    expect(result.summary.count).toBe(12);
    expect(request).toHaveBeenCalledWith('/reviews/product/101?page=2&pageSize=10', {
      signal,
      credentials: 'omit',
      cache: 'no-store',
    });
  });
  it.each(['legacy', 'wrong-page', 'oversized', 'wrong-total', 'wrong-next'])(
    'rechaza una respuesta paginada incompatible: %s',
    async (kind) => {
      const response = productReviewPage(1);
      if (kind === 'legacy') delete response.pagination;
      if (kind === 'wrong-page') response.pagination!.page = 2;
      if (kind === 'oversized') response.reviews.push(response.reviews[0]!);
      if (kind === 'wrong-total') response.pagination!.total = 99;
      if (kind === 'wrong-next') response.pagination!.hasNextPage = false;
      jest.spyOn(httpClient, 'request').mockResolvedValueOnce(response);
      await expect(productService.reviews('101')).rejects.toMatchObject({ kind: 'parse' });
    },
  );
  it('rechaza imágenes de esquemas no admitidos en la frontera HTTP', async () => {
    jest.spyOn(httpClient, 'request').mockResolvedValueOnce({
      product: productFixture(1, { imageUrl: 'file:///private/patient.pdf' }),
    });
    await expect(productService.detail('1')).rejects.toMatchObject({ kind: 'parse' });
  });
  it.each([
    {
      name: 'listado',
      read: (signal: AbortSignal) => productService.list(emptyProductFilters, 1, 10, signal),
      response: productPage(),
    },
    {
      name: 'detalle',
      read: (signal: AbortSignal) => productService.detail('1', signal),
      response: { product: productFixture(1) },
    },
    {
      name: 'promociones',
      read: (signal: AbortSignal) => productService.offers(signal),
      response: { promotions: [] },
    },
    {
      name: 'recomendaciones',
      read: (signal: AbortSignal) => productService.recommendations('1', signal),
      response: { recommendations: [] },
    },
    {
      name: 'reseñas',
      read: (signal: AbortSignal) => productService.reviews('1', signal),
      response: emptyReviewPage,
    },
  ])(
    'propaga no-store hasta fetch en $name, conservando lecturas públicas',
    async ({ read, response }) => {
      jest.mocked(fetch).mockResolvedValueOnce(jsonResponse(response));
      await read(new AbortController().signal);
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'GET', cache: 'no-store', credentials: 'omit' }),
      );
      expect(new Headers(jest.mocked(fetch).mock.calls[0][1]?.headers).has('Authorization')).toBe(
        false,
      );
    },
  );
  it('consulta reseñas y recomendaciones públicas y rechaza contratos inválidos', async () => {
    const request = jest
      .spyOn(httpClient, 'request')
      .mockResolvedValueOnce(emptyReviewPage)
      .mockResolvedValueOnce({ recommendations: [productFixture(2)] })
      .mockResolvedValueOnce({ reviews: [{ rating: 8 }] });
    const controller = new AbortController();
    await expect(productService.reviews('1', controller.signal)).resolves.toMatchObject({
      summary: { count: 0 },
    });
    await expect(productService.recommendations('1', controller.signal)).resolves.toMatchObject({
      recommendations: [{ id: 2 }],
    });
    expect(request).toHaveBeenNthCalledWith(1, '/reviews/product/1?page=1&pageSize=10', {
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
    });
    expect(request).toHaveBeenNthCalledWith(2, '/products/1/recommendations?limit=5', {
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
    });
    await expect(productService.reviews('1')).rejects.toMatchObject({ kind: 'parse' });
  });
  it('envía filtros confirmados y 10 productos por página, sin credenciales', async () => {
    const request = jest.spyOn(httpClient, 'request').mockResolvedValue(productPage());
    await productService.list(
      {
        ...emptyProductFilters,
        search: '  silla  ',
        marcas: ['A', 'A'],
        tipos: ['RENTA', 'MIXTO'],
        requiereReceta: false,
        soloDisponibles: true,
      },
      2,
    );
    const [path, options] = request.mock.calls[0];
    const url = new URL(path, 'https://example.com');
    expect(url.pathname).toBe('/products');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '2',
      pageSize: '10',
      sort: 'reciente',
      search: 'silla',
      marcas: 'A',
      tipos: 'MIXTO,RENTA',
      requiereReceta: 'false',
      soloDisponibles: 'true',
    });
    expect(options?.credentials).toBe('omit');
    expect(options?.cache).toBe('no-store');
    expect(url.searchParams.has('includeInactive')).toBe(false);
  });

  it('rechaza respuestas incompatibles y conserva errores HTTP', async () => {
    jest.spyOn(httpClient, 'request').mockResolvedValueOnce({ products: [] });
    await expect(productService.list(emptyProductFilters)).rejects.toMatchObject({ kind: 'parse' });
    const error = new ApiError('No disponible', { kind: 'http', status: 503 });
    jest.spyOn(httpClient, 'request').mockRejectedValueOnce(error);
    await expect(productService.detail('5')).rejects.toBe(error);
  });

  it('Home pide seis productos reales y nunca muestra más de seis', async () => {
    const request = jest.spyOn(httpClient, 'request').mockResolvedValue(productPage(1, 10, 10));
    const home = await homeService.getHome();
    expect(request.mock.calls[0][0]).toContain('pageSize=6');
    expect(home.products).toHaveLength(6);
    expect(home.products[0].id).toBe('1');
    expect(home.categories[0].id).toBe('mobility');
  });

  it('muestra el precio promocional del servidor y no aplica descuentos de compra a renta', () => {
    const offers = [
      {
        id: 1,
        productId: 1,
        discountPercent: 15,
        discountedPrice: 999.99,
        startAt: '2020-01-01T00:00:00.000Z',
        endAt: '2099-01-01T00:00:00.000Z',
      },
    ];
    const product = productFixture();
    expect(toProductCard(product, offers)).toMatchObject({
      price: '$999.99',
      originalPrice: '$1,200.00',
      discountPercent: 15,
    });
    expect(toProductCard(product, offers, 'rental')).toMatchObject({
      price: '$60.00',
      priceSuffix: '/ día',
      originalPrice: undefined,
    });
    expect(toProductCard({ ...product, stock: 0 }, offers)).toMatchObject({
      unavailable: true,
      originalPrice: undefined,
    });
    expect(
      toProductCard(product, [{ ...offers[0], endAt: '2021-01-01T00:00:00.000Z' }]).originalPrice,
    ).toBeUndefined();
    expect(toProductDetail(product, offers).description).toBe(product.descripcion);
  });

  it('conserva la ausencia de imagen sin sustituirla por una foto de muestra', () => {
    expect(toProductCard(productFixture(1, { imageUrl: null, images: [] })).image).toBeUndefined();
  });
});
