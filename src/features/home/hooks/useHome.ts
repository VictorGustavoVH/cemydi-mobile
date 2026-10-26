import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { seedProductDetail } from '@/services/products/product-cache';
import { homeService } from '../services/homeService.api';

/** Six public products; authentication and other Home connections remain separate. */
export function useHome() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['home', 'products'],
    queryFn: async ({ signal }) => {
      try {
        return await homeService.getHome(signal);
      } catch (cause) {
        throw cause instanceof Error ? cause : new Error('Error al cargar Home.');
      }
    },
    staleTime: 30_000,
  });
  const data = query.data;
  const dataUpdatedAt = query.dataUpdatedAt;
  // Inicio ya recibió los productos completos: los deja en la caché del detalle
  // para que abrir una ficha desde aquí no muestre el skeleton.
  useEffect(() => {
    for (const product of data?.rawProducts ?? []) {
      seedProductDetail(queryClient, product, dataUpdatedAt);
    }
  }, [data, dataUpdatedAt, queryClient]);
  return {
    data: query.data ?? null,
    loading: query.isPending || query.isFetching,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}
