import { ApiError, type ApiErrorKind } from '@/services/http/api-error';
import { productFixture, productPage } from '../../../../tests/support/product-fixtures';
import {
  createProductRepository,
  productRepository,
  type ProductRepository,
} from '../product-repository';
import { emptyProductFilters, productService } from '../product-service';

function fakeSource() {
  return {
    list: jest.fn<ReturnType<ProductRepository['list']>, Parameters<ProductRepository['list']>>(),
    detail: jest.fn<
      ReturnType<ProductRepository['detail']>,
      Parameters<ProductRepository['detail']>
    >(),
    recommendations: jest.fn<
      ReturnType<ProductRepository['recommendations']>,
      Parameters<ProductRepository['recommendations']>
    >(),
  } satisfies ProductRepository;
}

describe('ProductRepository', () => {
  it('delega listado, filtros, paginación y la misma señal sin transformar el resultado', async () => {
    const source = fakeSource();
    const result = productPage(2);
    source.list.mockResolvedValue(result);
    const repository = createProductRepository(source);
    const filters = { ...emptyProductFilters, search: '  silla  ', marcas: ['A', 'A'] };
    const controller = new AbortController();

    await expect(repository.list(filters, 2, 24, controller.signal)).resolves.toBe(result);
    expect(source.list).toHaveBeenCalledTimes(1);
    expect(source.list).toHaveBeenCalledWith(filters, 2, 24, controller.signal);
    expect(source.list.mock.calls[0][0]).toBe(filters);
    expect(source.list.mock.calls[0][3]).toBe(controller.signal);
    expect(filters.search).toBe('  silla  ');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('conserva id, señal y envelope del detalle y las recomendaciones', async () => {
    const source = fakeSource();
    const detail = { product: productFixture(7) };
    const recommendations = { recommendations: [productFixture(8)] };
    source.detail.mockResolvedValue(detail);
    source.recommendations.mockResolvedValue(recommendations);
    const repository = createProductRepository(source);
    const controller = new AbortController();

    await expect(repository.detail('7', controller.signal)).resolves.toBe(detail);
    await expect(repository.recommendations('7', controller.signal)).resolves.toBe(recommendations);
    expect(source.detail).toHaveBeenCalledWith('7', controller.signal);
    expect(source.recommendations).toHaveBeenCalledWith('7', controller.signal);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('usa productService por defecto y conserva sus parámetros opcionales', async () => {
    const result = productPage();
    const list = jest.spyOn(productService, 'list').mockResolvedValue(result);
    const detail = jest
      .spyOn(productService, 'detail')
      .mockResolvedValue({ product: result.products[0] });
    const recommendations = jest
      .spyOn(productService, 'recommendations')
      .mockResolvedValue({ recommendations: [] });

    await expect(productRepository.list(emptyProductFilters)).resolves.toBe(result);
    await productRepository.detail('1');
    await productRepository.recommendations('1');
    expect(list).toHaveBeenCalledWith(emptyProductFilters, undefined, undefined, undefined);
    expect(detail).toHaveBeenCalledWith('1', undefined);
    expect(recommendations).toHaveBeenCalledWith('1', undefined);
  });

  describe.each(['list', 'detail', 'recommendations'] as const)('%s', (operation) => {
    it.each<ApiErrorKind>(['http', 'network', 'timeout', 'parse', 'abort'])(
      'propaga el mismo error %s sin fallback ni reintentos',
      async (kind) => {
        const source = fakeSource();
        const error = new ApiError('Error de prueba', {
          kind,
          status: kind === 'http' ? 404 : undefined,
        });
        source[operation].mockRejectedValue(error);
        const repository = createProductRepository(source);
        const request =
          operation === 'list' ? repository.list(emptyProductFilters) : repository[operation]('7');

        await expect(request).rejects.toBe(error);
        expect(source[operation]).toHaveBeenCalledTimes(1);
        expect(fetch).not.toHaveBeenCalled();
      },
    );
  });
});
