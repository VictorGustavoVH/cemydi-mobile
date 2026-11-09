import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient } from '@tanstack/react-query';
import { QueryTestProvider } from '../../../../tests/support/query-wrapper';
import { productFixture } from '../../../../tests/support/product-fixtures';
import { productRepository } from '@/services/products/product-repository';
import { useProductRecommendations } from '../hooks/useProductRecommendations';

it('filtra productos desactivados desde la respuesta y tras actualizar la caché', async () => {
  const active = productFixture(2),
    inactive = productFixture(3, { activo: false });
  jest
    .spyOn(productRepository, 'recommendations')
    .mockResolvedValue({ recommendations: [inactive, active] });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const view = await renderHook(() => useProductRecommendations('1', []), {
    wrapper: ({ children }) => <QueryTestProvider client={client}>{children}</QueryTestProvider>,
  });
  await waitFor(() => expect(view.result.current.query.isSuccess).toBe(true));
  expect(view.result.current.products.map((product) => product.id)).toEqual(['2']);
  await act(async () => {
    client.setQueryData(['products', 'recommendations', '1'], {
      recommendations: [{ ...active, activo: false }, inactive],
    });
  });
  await waitFor(() => expect(view.result.current.products).toEqual([]));
  await view.unmount();
});

it('no consulta recomendaciones de identificadores inválidos', async () => {
  const request = jest.spyOn(productRepository, 'recommendations');
  const view = await renderHook(() => useProductRecommendations('wheelchair', undefined), {
    wrapper: QueryTestProvider,
  });
  expect(request).not.toHaveBeenCalled();
  expect(view.result.current.products).toEqual([]);
  await view.unmount();
});
