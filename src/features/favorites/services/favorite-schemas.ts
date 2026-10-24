import { z } from 'zod';
import { productSchema } from '@/services/products/product-schemas';

export const favoritesListResponseSchema = z.object({
  products: z.array(productSchema),
  favoriteIds: z.array(z.number().int().positive()),
  total: z.number().int().nonnegative(),
});

export const favoriteIdsResponseSchema = z.object({
  favoriteIds: z.array(z.number().int().positive()),
});

export const toggleFavoriteResponseSchema = z.object({
  message: z.string(),
  favorited: z.boolean(),
  productId: z.number().int().positive(),
});

export type FavoritesListResponse = z.infer<typeof favoritesListResponseSchema>;
export type FavoriteIdsResponse = z.infer<typeof favoriteIdsResponseSchema>;
export type ToggleFavoriteResponse = z.infer<typeof toggleFavoriteResponseSchema>;
