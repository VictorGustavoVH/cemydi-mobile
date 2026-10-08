import { httpClient } from '@/services/http/client';
import { ApiError } from '@/services/http/api-error';
import { productFixture, productPage } from '../../../../tests/support/product-fixtures';
import { homeService } from '@/features/home/services/homeService.api';
import { emptyProductFilters, productService } from '../product-service';
import { toProductCard, toProductDetail } from '../product-adapter';

describe('Contratos públicos del catálogo', () => {
  it('consulta reseñas y recomendaciones públicas y rechaza contratos inválidos', async () => {
    const request = jest
      .spyOn(httpClient, 'request')
      .mockResolvedValueOnce({ reviews: [], summary: { count: 0, averageRating: 0 } })
      .mockResolvedValueOnce({ recommendations: [productFixture(2)] })
      .mockResolvedValueOnce({ reviews: [{ rating: 8 }] });
    const controller = new AbortController();
    await expect(productService.reviews('1', controller.signal)).resolves.toMatchObject({
      summary: { count: 0 },
    });
    await expect(productService.recommendations('1', controller.signal)).resolves.toMatchObject({
      recommendations: [{ id: 2 }],
    });
    expect(request).toHaveBeenNthCalledWith(1, '/reviews/product/1', {
      signal: controller.signal,
      credentials: 'omit',
    });
    expect(request).toHaveBeenNthCalledWith(2, '/products/1/recommendations?limit=5', {
      signal: controller.signal,
      credentials: 'omit',
    });
    await expect(productService.reviews('1')).rejects.toMatchObject({ kind: 'parse' });
  });
  it('envía filtros confirmados y 24 productos por página, sin credenciales', async () => {
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
      pageSize: '24',
      sort: 'reciente',
      search: 'silla',
      marcas: 'A',
      tipos: 'MIXTO,RENTA',
      requiereReceta: 'false',
      soloDisponibles: 'true',
    });
    expect(options?.credentials).toBe('omit');
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
