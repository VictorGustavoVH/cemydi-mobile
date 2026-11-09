import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { productService } from '@/services/products/product-service';

export function useProductReviews(productId: string, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: ['reviews', 'product', productId, 'pages'],
    initialPageParam: 1,
    queryFn: ({ signal, pageParam }) => productService.reviews(productId, signal, pageParam),
    getNextPageParam: (lastPage) =>
      lastPage.pagination?.hasNextPage ? lastPage.pagination.page + 1 : undefined,
    enabled: enabled && /^[1-9]\d*$/.test(productId) && Number.isSafeInteger(Number(productId)),
    staleTime: 30_000,
  });
  const data = useMemo(() => {
    if (!query.data) return undefined;
    const pages = query.data.pages;
    return {
      summary: pages[0]!.summary,
      reviews: [
        ...new Map(
          pages.flatMap((page) => page.reviews).map((review) => [review.id, review]),
        ).values(),
      ],
      pagination: pages[pages.length - 1]?.pagination,
    };
  }, [query.data]);
  return { ...query, data };
}
