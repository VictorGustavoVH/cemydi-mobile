import type { ReactNode } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryTestProvider } from '../../../tests/support/query-wrapper';
import { productService } from '@/services/products/product-service';
import { useProductRatings } from '../useProductRatings';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryTestProvider>{children}</QueryTestProvider>
);

describe('useProductRatings', () => {
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
