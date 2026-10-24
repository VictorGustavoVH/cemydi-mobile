import { useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/hooks/useToast';
import { useAccountAccess } from '@/hooks/useAccountAccess';
import { seedProductDetail } from '@/services/products/product-cache';
import { favoriteService } from '../services/favorite-service';
import type { FavoritesListResponse, FavoriteIdsResponse } from '../services/favorite-schemas';

export function useFavorites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { requestAccess } = useAccountAccess();

  const userKey = user?.id ?? 0;
  const listKey = useMemo(() => ['favorites', userKey] as const, [userKey]);
  const idsKey = useMemo(() => ['favorites', 'ids', userKey] as const, [userKey]);

  const favoritesQuery = useQuery({
    queryKey: listKey,
    queryFn: ({ signal }) => favoriteService.listMine(signal),
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  const idsQuery = useQuery({
    queryKey: idsKey,
    queryFn: ({ signal }) => favoriteService.listMyIds(signal),
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  const favoritesData = favoritesQuery.data;
  const favoritesUpdatedAt = favoritesQuery.dataUpdatedAt;
  // Los favoritos ya recibidos son productos completos: dejan la caché del
  // detalle lista para que abrirlo desde aquí no monte el skeleton.
  useEffect(() => {
    for (const product of favoritesData?.products ?? []) {
      seedProductDetail(queryClient, product, favoritesUpdatedAt);
    }
  }, [favoritesData, favoritesUpdatedAt, queryClient]);

  const favoriteIds = useMemo(() => {
    if (!user) return new Set<number>();
    if (idsQuery.data?.favoriteIds) {
      return new Set(idsQuery.data.favoriteIds);
    }
    if (favoritesQuery.data?.favoriteIds) {
      return new Set(favoritesQuery.data.favoriteIds);
    }
    return new Set<number>();
  }, [user, idsQuery.data, favoritesQuery.data]);

  const isFavorite = useCallback(
    (productId: number | string) => {
      const id = Number(productId);
      return Number.isFinite(id) && favoriteIds.has(id);
    },
    [favoriteIds],
  );

  const toggleMutation = useMutation({
    mutationFn: (productId: number) => favoriteService.toggle(productId),
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: idsKey });
      await queryClient.cancelQueries({ queryKey: listKey });

      const prevIds = queryClient.getQueryData<FavoriteIdsResponse>(idsKey);
      const prevList = queryClient.getQueryData<FavoritesListResponse>(listKey);

      // Optimistic update of IDs
      queryClient.setQueryData<FavoriteIdsResponse>(idsKey, (current) => {
        const existing = current?.favoriteIds ?? [];
        const next = existing.includes(productId)
          ? existing.filter((id) => id !== productId)
          : [...existing, productId];
        return { favoriteIds: next };
      });

      // Optimistic update of list if loaded
      queryClient.setQueryData<FavoritesListResponse>(listKey, (current) => {
        if (!current) return current;
        const exists = current.favoriteIds.includes(productId);
        if (exists) {
          const nextProducts = current.products.filter((p) => p.id !== productId);
          return {
            products: nextProducts,
            favoriteIds: current.favoriteIds.filter((id) => id !== productId),
            total: nextProducts.length,
          };
        }
        return current;
      });

      return { prevIds, prevList };
    },
    onError: (_err, _productId, context) => {
      if (context?.prevIds) {
        queryClient.setQueryData(idsKey, context.prevIds);
      }
      if (context?.prevList) {
        queryClient.setQueryData(listKey, context.prevList);
      }
      toast.error('No se pudo actualizar tu lista de favoritos.');
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: idsKey });
      void queryClient.invalidateQueries({ queryKey: listKey });
      toast.info(data.favorited ? 'Guardado en tus favoritos.' : 'Eliminado de tus favoritos.');
    },
  });

  const toggleFavorite = useCallback(
    (productId: number | string) => {
      if (!user) {
        requestAccess('/perfil', { showToast: true });
        return;
      }
      const id = Number(productId);
      if (Number.isFinite(id) && id > 0) {
        toggleMutation.mutate(id);
      }
    },
    [user, requestAccess, toggleMutation],
  );

  return {
    products: favoritesQuery.data?.products ?? [],
    total: favoritesQuery.data?.total ?? 0,
    favoriteIds,
    isFavorite,
    toggleFavorite,
    isLoading: favoritesQuery.isLoading,
    isFetching: favoritesQuery.isFetching,
    isError: favoritesQuery.isError,
    error: favoritesQuery.error,
    refetch: favoritesQuery.refetch,
    isPendingToggle: toggleMutation.isPending,
  };
}
