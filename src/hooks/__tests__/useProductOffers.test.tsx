import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryTestProvider } from '../../../tests/support/query-wrapper';
import { productService } from '@/services/products/product-service';
import { useProductOffers } from '../useProductOffers';

describe('Vigencia visual de ofertas', () => {
  afterEach(() => jest.useRealTimers());
  it('retira una oferta al vencer aunque el usuario siga en la pantalla', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-08T12:00:00.000Z'));
    jest.spyOn(productService, 'offers').mockResolvedValue({
      promotions: [
        {
          id: 1,
          productId: 1,
          discountPercent: 15,
          discountedPrice: 999,
          startAt: '2026-10-08T11:00:00.000Z',
          endAt: '2026-10-08T12:00:01.000Z',
        },
      ],
    });
    const { result, unmount } = await renderHook(useProductOffers, { wrapper: QueryTestProvider });
    await waitFor(() => expect(result.current.data?.promotions).toHaveLength(1));
    await act(() => jest.advanceTimersByTime(1100));
    expect(result.current.data?.promotions).toHaveLength(0);
    expect(productService.offers).toHaveBeenCalledTimes(1);
    await unmount();
  });
});
