import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { useOptionalCatalogPreview } from '@/providers/catalog-preview-provider';
import { useToast } from '@/hooks/useToast';
import { useAccountAccess } from '@/hooks/useAccountAccess';
import { seedProductDetail } from '@/services/products/product-cache';
import { favoriteService } from '../services/favorite-service';
import type { FavoritesListResponse, FavoriteIdsResponse } from '../services/favorite-schemas';

export function useFavorites() {
  const { user, getSession, getSessionVersion } = useAuth();
  const guest = useOptionalCatalogPreview();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { requestAccess } = useAccountAccess();

  const userKey = user?.id ?? 0;
  const listKey = useMemo(() => ['favorites', userKey] as const, [userKey]);
  const idsKey = useMemo(() => ['favorites', 'ids', userKey] as const, [userKey]);
  const mutationKey = useMemo(() => ['favorites', 'toggle', userKey] as const, [userKey]);
  const pendingToggles = useIsMutating({ mutationKey });
  const toggleLock = useRef(false);
  const sessionVersion = getSessionVersion();
  const isCurrent = () =>
    getSession().user?.id === userKey && getSessionVersion() === sessionVersion;

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
  const products = useMemo(
    () => (favoritesData?.products ?? []).filter((product) => product.activo === true),
    [favoritesData],
  );
  const favoritesUpdatedAt = favoritesQuery.dataUpdatedAt;
  // Los favoritos ya recibidos son productos completos: dejan la caché del
  // detalle lista para que abrirlo desde aquí no monte el skeleton.
  useEffect(() => {
    for (const product of products) {
      seedProductDetail(queryClient, product, favoritesUpdatedAt);
    }
  }, [products, favoritesUpdatedAt, queryClient]);

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
    mutationKey,
    mutationFn: (productId: number) => {
      if (!isCurrent()) throw new Error('La sesión cambió.');
      return favoriteService.toggle(productId);
    },
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: idsKey });
      await queryClient.cancelQueries({ queryKey: listKey });

      if (!isCurrent()) return;

      const prevList = queryClient.getQueryData<FavoritesListResponse>(listKey);
      const prevIds =
        queryClient.getQueryData<FavoriteIdsResponse>(idsKey) ??
        (prevList ? { favoriteIds: prevList.favoriteIds } : undefined);

      // Optimistic update of IDs
      queryClient.setQueryData<FavoriteIdsResponse>(idsKey, (current) => {
        const existing = current?.favoriteIds ?? prevIds?.favoriteIds ?? [];
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
      if (!isCurrent()) return;
      if (context?.prevIds) {
        queryClient.setQueryData(idsKey, context.prevIds);
      }
      if (context?.prevList) {
        queryClient.setQueryData(listKey, context.prevList);
      }
      toast.error('No se pudo actualizar tu lista de favoritos.');
    },
    onSuccess: (data, productId) => {
      if (!isCurrent()) return;
      // An explicit account choice supersedes any pending selection made as a guest.
      guest?.removeFavorite(String(productId));
      queryClient.setQueryData<FavoriteIdsResponse>(idsKey, (current) => {
        const ids = current?.favoriteIds ?? [];
        return {
          favoriteIds: data.favorited
            ? Array.from(new Set([...ids, productId]))
            : ids.filter((id) => id !== productId),
        };
      });
      toast.info(data.favorited ? 'Guardado en tus favoritos.' : 'Eliminado de tus favoritos.');
    },
    onSettled: async () => {
      try {
        if (isCurrent())
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: idsKey }),
            queryClient.invalidateQueries({ queryKey: listKey }),
          ]);
      } finally {
        toggleLock.current = false;
      }
    },
  });

  const idsReady = Boolean(
    user &&
    ((idsQuery.data && !idsQuery.isError) || (favoritesQuery.data && !favoritesQuery.isError)),
  );

  const toggleFavorite = useCallback(
    (productId: number | string) => {
      if (!user) {
        requestAccess('/perfil', { showToast: true });
        return;
      }
      const id = Number(productId);
      if (!idsReady || toggleLock.current || queryClient.isMutating({ mutationKey }) > 0) return;
      if (Number.isSafeInteger(id) && id > 0) {
        toggleLock.current = true;
        toggleMutation.mutate(id);
      }
    },
    [user, requestAccess, toggleMutation, idsReady, queryClient, mutationKey],
  );

  return {
    products,
    total: products.length,
    favoriteIds,
    isFavorite,
    toggleFavorite,
    isLoading: favoritesQuery.isLoading,
    isFetching: favoritesQuery.isFetching,
    isError: favoritesQuery.isError,
    error: favoritesQuery.error,
    refetch: favoritesQuery.refetch,
    isPendingToggle: pendingToggles > 0,
    idsReady,
    isResolvingIds: Boolean(user && !idsReady && (idsQuery.isPending || favoritesQuery.isPending)),
  };
}
