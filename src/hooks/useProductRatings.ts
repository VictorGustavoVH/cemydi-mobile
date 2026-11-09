import { useCallback, useMemo } from 'react';
import { useQueries, type UseQueryResult } from '@tanstack/react-query';
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

  const combine = useCallback(
    (results: UseQueryResult<ProductReviews>[]) => {
      const ratings: Record<string, ProductRatingState> = {};
      ids.forEach((productId, index) => {
        const result = results[index];
        const summary = result?.data?.summary;
        ratings[productId] = {
          summary,
          isPaused: !summary && (result?.isPaused ?? false),
          isError: !summary && (result?.isError ?? false),
          isFetching: !summary && (result?.isFetching ?? false),
        };
      });
      return ratings;
    },
    [ids],
  );

  // useQueries conserva por structural sharing el mapa y cada resumen. Un
  // refetch con datos visibles no cambia el estado que consumen las tarjetas.
  return useQueries({
    queries: ids.map((productId) => ({
      queryKey: ['reviews', 'product', productId],
      queryFn: ({ signal }) => productService.reviews(productId, signal),
      staleTime: 30_000,
    })),
    combine,
  });
}
