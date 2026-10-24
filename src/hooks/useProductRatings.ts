import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { productService } from '@/services/products/product-service';
import type { ProductReviews } from '@/services/products/product-schemas';

/**
 * Estado de valoración que una pantalla calcula en lote para sus tarjetas.
 * ProductCard ya no consulta reseñas por su cuenta: recibe este estado por
 * props para que todas las consultas de una cuadrícula se coordinen desde un
 * único lugar.
 */
export type ProductRatingState = {
  summary?: ProductReviews['summary'];
  isPaused: boolean;
  isError: boolean;
  isFetching: boolean;
};

const isRemoteProductId = (productId: string) =>
  /^[1-9]\d*$/.test(productId) && Number.isSafeInteger(Number(productId));

/**
 * Consulta el resumen de reseñas de los productos visibles mediante
 * `useQueries`. Sigue siendo una petición por producto (el backend no expone
 * un endpoint por lote), pero se centraliza y deduplica la caché compartida
 * con el detalle. Los ids locales de fixtures no consultan la API.
 */
export function useProductRatings(productIds: string[]) {
  const ids = useMemo(
    () => Array.from(new Set(productIds.filter(isRemoteProductId))),
    [productIds],
  );

  const results = useQueries({
    queries: ids.map((productId) => ({
      queryKey: ['reviews', 'product', productId],
      queryFn: ({ signal }) => productService.reviews(productId, signal),
      staleTime: 30_000,
    })),
  });

  return useMemo(() => {
    const ratings: Record<string, ProductRatingState> = {};

    ids.forEach((productId, index) => {
      const result = results[index];
      ratings[productId] = {
        summary: result?.data?.summary,
        isPaused: result?.isPaused ?? false,
        isError: result?.isError ?? false,
        isFetching: result?.isFetching ?? false,
      };
    });

    return ratings;
  }, [ids, results]);
}
