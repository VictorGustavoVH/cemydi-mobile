import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { productRepository, type ProductRepository } from '@/services/products/product-repository';
import {
  CATALOG_PAGE_SIZE,
  normalizeProductFilters,
  type ProductFilters,
} from '@/services/products/product-service';

export function useCatalog(
  filters: ProductFilters,
  page: number,
  repository: ProductRepository = productRepository,
) {
  const normalized = normalizeProductFilters(filters);
  const query = useQuery({
    queryKey: ['products', 'list', normalized, page, CATALOG_PAGE_SIZE],
    queryFn: ({ signal }) => repository.list(normalized, page, CATALOG_PAGE_SIZE, signal),
    // La página anterior permanece visible mientras llega la nueva: evita el
    // parpadeo del skeleton y que el footer de paginación desaparezca.
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  return {
    ...query,
    products: query.data?.products ?? [],
    filters: query.data?.filters,
    pagination: query.data?.pagination,
  };
}
