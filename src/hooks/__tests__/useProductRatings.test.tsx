import type { ReactNode } from 'react';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryTestProvider } from '../../../tests/support/query-wrapper';
import { productService } from '@/services/products/product-service';
import { useProductRatings } from '../useProductRatings';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryTestProvider>{children}</QueryTestProvider>
);

describe('useProductRatings', () => {
  it('conserva la identidad durante un refetch y publica un resumen modificado', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    const data = { reviews: [], summary: { count: 2, averageRating: 4 } };
    client.setQueryData(['reviews', 'product', '1'], data);
    let finish!: (value: typeof data) => void;
    jest.spyOn(productService, 'reviews').mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = await renderHook(() => useProductRatings(['1']), {
      wrapper: ({ children }) => <QueryTestProvider client={client}>{children}</QueryTestProvider>,
    });
    const before = result.current;
    let refresh!: Promise<void>;
    await act(() => {
      refresh = client.invalidateQueries({ queryKey: ['reviews', 'product', '1'] });
    });
    expect(result.current).toBe(before);
    await act(async () => {
      finish({ reviews: [], summary: { count: 3, averageRating: 5 } });
      await refresh;
    });
    await waitFor(() => expect(result.current['1'].summary?.count).toBe(3));
    expect(result.current).not.toBe(before);
  });
  it('deduplica ids remotos y deja fuera los fixtures locales', async () => {
    const reviews = jest.spyOn(productService, 'reviews').mockResolvedValue({
      reviews: [],
      summary: { count: 3, averageRating: 4.5 },
    });

    const { result } = await renderHook(() => useProductRatings(['1', '1', 'wheelchair', '2']), {
      wrapper,
    });

    await waitFor(() =>
      expect(result.current['1']?.summary).toEqual({ count: 3, averageRating: 4.5 }),
    );
    await waitFor(() =>
      expect(result.current['2']?.summary).toEqual({ count: 3, averageRating: 4.5 }),
    );
    expect(result.current.wheelchair).toBeUndefined();
    expect(reviews).toHaveBeenCalledTimes(2);
    expect(reviews).toHaveBeenCalledWith('1', expect.any(AbortSignal));
    expect(reviews).toHaveBeenCalledWith('2', expect.any(AbortSignal));
  });

  it('expone el error sin inventar un resumen', async () => {
    jest.spyOn(productService, 'reviews').mockRejectedValue(new Error('Datos internos'));

    const { result } = await renderHook(() => useProductRatings(['1']), { wrapper });

    await waitFor(() => expect(result.current['1']?.isError).toBe(true));
    expect(result.current['1']?.summary).toBeUndefined();
  });

  it('marca la consulta en pausa cuando no hay conexión', async () => {
    const reviews = jest.spyOn(productService, 'reviews').mockResolvedValue({
      reviews: [],
      summary: { count: 0, averageRating: 0 },
    });
    onlineManager.setOnline(false);

    const view = await renderHook(() => useProductRatings(['1']), { wrapper });
    try {
      await waitFor(() => expect(view.result.current['1']?.isPaused).toBe(true));
      expect(reviews).not.toHaveBeenCalled();
    } finally {
      await view.unmount();
      onlineManager.setOnline(true);
    }
  });
});
