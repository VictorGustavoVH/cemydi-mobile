import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productRepository } from '@/services/products/product-repository';
import { toProductCard } from '@/services/products/product-adapter';
import type { ProductOffer } from '@/services/products/product-schemas';

export function useProductRecommendations(
  productId: string,
  promotions: ProductOffer[] | undefined,
) {
  const query = useQuery({
    queryKey: ['products', 'recommendations', productId],
    queryFn: ({ signal }) => productRepository.recommendations(productId, signal),
    enabled: /^[1-9]\d*$/.test(productId) && Number.isSafeInteger(Number(productId)),
    staleTime: 30_000,
  });

  // ADAPTAR PRODUCTOS RECOMENDADOS
  const recommendedProducts = useMemo(
    () =>
      query.data?.recommendations
        .filter((item) => item.activo === true)
        .map((item) => toProductCard(item, promotions)) ?? [],
    [query.data, promotions],
  );

  return { query, products: recommendedProducts };
}
