import { httpClient } from '@/services/http/client';
import { ApiError } from '@/services/http/api-error';
import {
  favoriteIdsResponseSchema,
  favoritesListResponseSchema,
  toggleFavoriteResponseSchema,
  type FavoriteIdsResponse,
  type FavoritesListResponse,
  type ToggleFavoriteResponse,
} from './favorite-schemas';

export const favoriteService = {
  async listMine(signal?: AbortSignal): Promise<FavoritesListResponse> {
    const data = await httpClient.request('/favorites', {
      authenticated: true,
      cache: 'no-store',
      signal,
    });
    const parsed = favoritesListResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new ApiError(
        'La lista de favoritos devuelta por el servidor no tiene el formato esperado.',
        {
          kind: 'parse',
          cause: parsed.error,
        },
      );
    }
    return parsed.data;
  },

  async listMyIds(signal?: AbortSignal): Promise<FavoriteIdsResponse> {
    const data = await httpClient.request('/favorites/ids', {
      authenticated: true,
      cache: 'no-store',
      signal,
    });
    const parsed = favoriteIdsResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new ApiError('Los identificadores de favoritos devueltos no son válidos.', {
        kind: 'parse',
        cause: parsed.error,
      });
    }
    return parsed.data;
  },

  async toggle(productId: number, signal?: AbortSignal): Promise<ToggleFavoriteResponse> {
    const data = await httpClient.request(`/favorites/toggle/${encodeURIComponent(productId)}`, {
      authenticated: true,
      method: 'POST',
      signal,
    });
    const parsed = toggleFavoriteResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new ApiError('No se pudo confirmar el cambio en favoritos.', {
        kind: 'parse',
        cause: parsed.error,
      });
    }
    return parsed.data;
  },

  async add(productId: number, signal?: AbortSignal): Promise<ToggleFavoriteResponse> {
    const data = await httpClient.request(`/favorites/${encodeURIComponent(productId)}`, {
      authenticated: true,
      method: 'POST',
      signal,
    });
    const parsed = toggleFavoriteResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new ApiError('No se pudo agregar a favoritos.', {
        kind: 'parse',
        cause: parsed.error,
      });
    }
    return parsed.data;
  },

  async remove(productId: number, signal?: AbortSignal): Promise<ToggleFavoriteResponse> {
    const data = await httpClient.request(`/favorites/${encodeURIComponent(productId)}`, {
      authenticated: true,
      method: 'DELETE',
      signal,
    });
    const parsed = toggleFavoriteResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new ApiError('No se pudo eliminar de favoritos.', {
        kind: 'parse',
        cause: parsed.error,
      });
    }
    return parsed.data;
  },
};
