import type { z } from 'zod';
import { httpClient } from '@/services/http/client';
import { ApiError } from '@/services/http/api-error';
import {
  productDetailSchema,
  productListSchema,
  promotionsSchema,
  productRecommendationsSchema,
  productReviewsSchema,
} from './product-schemas';

export const CATALOG_PAGE_SIZE = 24;
export const HOME_PRODUCT_LIMIT = 6;
export const catalogSortOptions = [
  { value: 'reciente', label: 'Más recientes' },
  { value: 'precio-asc', label: 'Menor precio' },
  { value: 'precio-desc', label: 'Mayor precio' },
  { value: 'disponibles', label: 'Disponibles primero' },
  { value: 'popular', label: 'Más populares' },
  { value: 'nombre-asc', label: 'Nombre A-Z' },
  { value: 'nombre-desc', label: 'Nombre Z-A' },
] as const;
export type ProductFilters = {
  search: string;
  clasificaciones: string[];
  marcas: string[];
  tipos: ('VENTA' | 'RENTA' | 'MIXTO')[];
  requiereReceta: boolean | null;
  soloDisponibles: boolean;
  sort: (typeof catalogSortOptions)[number]['value'];
};
export const emptyProductFilters: ProductFilters = {
  search: '',
  clasificaciones: [],
  marcas: [],
  tipos: [],
  requiereReceta: null,
  soloDisponibles: false,
  sort: 'reciente',
};

export function normalizeProductFilters(filters: ProductFilters): ProductFilters {
  return {
    ...filters,
    search: filters.search.trim().slice(0, 120),
    clasificaciones: [...new Set(filters.clasificaciones)].sort(),
    marcas: [...new Set(filters.marcas)].sort(),
    tipos: [...new Set(filters.tipos)].sort(),
  };
}

async function read<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  const response = await httpClient.request(path, { signal, credentials: 'omit' });
  const parsed = schema.safeParse(response);
  if (!parsed.success) {
    throw new ApiError('La respuesta del catálogo no tiene el formato esperado.', {
      kind: 'parse',
      cause: parsed.error,
    });
  }
  return parsed.data;
}

export const productService = {
  list(filters: ProductFilters, page = 1, pageSize = CATALOG_PAGE_SIZE, signal?: AbortSignal) {
    const normalized = normalizeProductFilters(filters);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sort: normalized.sort,
    });
    if (normalized.search) params.set('search', normalized.search);
    for (const key of ['clasificaciones', 'marcas', 'tipos'] as const) {
      if (normalized[key].length) params.set(key, normalized[key].join(','));
    }
    if (normalized.requiereReceta !== null)
      params.set('requiereReceta', String(normalized.requiereReceta));
    if (normalized.soloDisponibles) params.set('soloDisponibles', 'true');
    return read(`/products?${params}`, productListSchema, signal);
  },
  detail(id: string, signal?: AbortSignal) {
    return read(`/products/${encodeURIComponent(id)}`, productDetailSchema, signal);
  },
  offers(signal?: AbortSignal) {
    return read('/promotions', promotionsSchema, signal);
  },
  recommendations(id: string, signal?: AbortSignal) {
    return read(
      `/products/${encodeURIComponent(id)}/recommendations?limit=5`,
      productRecommendationsSchema,
      signal,
    );
  },
  reviews(id: string, signal?: AbortSignal) {
    return read(`/reviews/product/${encodeURIComponent(id)}`, productReviewsSchema, signal);
  },
};
