import { useQuery } from '@tanstack/react-query';
import { productService } from '@/services/products/product-service';

export function useProductReviews(productId: string, enabled = true) {
  return useQuery({
    queryKey: ['reviews', 'product', productId],
    queryFn: ({ signal }) => productService.reviews(productId, signal),
    enabled: enabled && /^[1-9]\d*$/.test(productId) && Number.isSafeInteger(Number(productId)),
    staleTime: 30_000,
  });
}
