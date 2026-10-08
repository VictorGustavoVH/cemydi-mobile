import { useQuery } from '@tanstack/react-query';
import { homeService } from '../services/homeService.api';

/** Six public products; authentication and other Home connections remain separate. */
export function useHome() {
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
  return {
    data: query.data ?? null,
    loading: query.isPending || query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
