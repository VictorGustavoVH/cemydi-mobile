import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient } from '@tanstack/react-query';
import { QueryTestProvider } from '../../../tests/support/query-wrapper';
import { productReviewPage } from '../../../tests/support/product-fixtures';
import { productService } from '@/services/products/product-service';
import { useProductReviews } from '../useProductReviews';

it('carga páginas bajo demanda, conserva datos al fallar y reintenta la misma página sin duplicados', async () => {
  const second = productReviewPage(2);
  second.reviews.unshift(productReviewPage(1).reviews[0]!);
  const request = jest
    .spyOn(productService, 'reviews')
    .mockResolvedValueOnce(productReviewPage(1))
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce(second);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  client.setQueryData(['reviews', 'product', '101'], {
    reviews: [],
    summary: { count: 999, averageRating: 1 },
  });
  const view = await renderHook(() => useProductReviews('101'), {
    wrapper: ({ children }) => <QueryTestProvider client={client}>{children}</QueryTestProvider>,
  });
  await waitFor(() => expect(view.result.current.data?.reviews).toHaveLength(10));
  expect(view.result.current.data?.summary.count).toBe(12);
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => {
    await view.result.current.fetchNextPage();
  });
  await waitFor(() => expect(view.result.current.isFetchNextPageError).toBe(true));
  expect(view.result.current.data?.reviews).toHaveLength(10);
  await act(async () => {
    await view.result.current.fetchNextPage();
  });
  await waitFor(() => expect(view.result.current.data?.reviews).toHaveLength(12));
  expect(request.mock.calls.map((call) => call[2])).toEqual([1, 2, 2]);
  expect(view.result.current.hasNextPage).toBe(false);
  expect(view.result.current.data?.summary.count).toBe(12);
  await view.unmount();
});

it('no consulta ids inválidos ni reutiliza páginas del producto anterior', async () => {
  const request = jest.spyOn(productService, 'reviews').mockResolvedValue(productReviewPage(1));
  const view = await renderHook(({ id }: { id: string }) => useProductReviews(id), {
    initialProps: { id: 'bad' },
    wrapper: QueryTestProvider,
  });
  expect(request).not.toHaveBeenCalled();
  await view.rerender({ id: '101' });
  await waitFor(() => expect(view.result.current.data?.reviews).toHaveLength(10));
  request.mockResolvedValue(productReviewPage(1, 0));
  await view.rerender({ id: '202' });
  await waitFor(() => expect(view.result.current.data?.summary.count).toBe(0));
  expect(view.result.current.data?.reviews).toEqual([]);
  expect(request.mock.calls.map((call) => call[0])).toEqual(['101', '202']);
  await view.unmount();
});
