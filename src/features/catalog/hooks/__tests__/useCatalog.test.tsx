import { renderHook, waitFor } from '@testing-library/react-native';
import type { ProductRepository } from '@/services/products/product-repository';
import { emptyProductFilters, normalizeProductFilters } from '@/services/products/product-service';
import { productPage } from '../../../../../tests/support/product-fixtures';
import { QueryTestProvider } from '../../../../../tests/support/query-wrapper';
import { useCatalog } from '../useCatalog';

it('sustituye el repositorio de producción y cancela su señal al desmontar', async () => {
  const page = productPage();
  const list = jest
    .fn<ReturnType<ProductRepository['list']>, Parameters<ProductRepository['list']>>()
    .mockResolvedValueOnce(page)
    .mockImplementationOnce(() => new Promise(() => undefined));
  const repository: ProductRepository = {
    list,
    detail: async () => ({ product: page.products[0] }),
    recommendations: async () => ({ recommendations: [] }),
  };
  const filters = { ...emptyProductFilters, search: '  silla  ' };
  const view = await renderHook(() => useCatalog(filters, repository), {
    wrapper: QueryTestProvider,
  });

  await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
  expect(list).toHaveBeenCalledWith(
    normalizeProductFilters(filters),
    1,
    undefined,
    expect.any(AbortSignal),
  );
  expect(view.result.current.products).toEqual(page.products);

  // Otra key deja una consulta pendiente: su señal debe llegar al repositorio y abortarse.
  filters.search = 'andadera';
  await view.rerender(undefined);
  await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  const signal = list.mock.calls[1][3];
  expect(signal?.aborted).toBe(false);
  await view.unmount();
  expect(signal?.aborted).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
});
