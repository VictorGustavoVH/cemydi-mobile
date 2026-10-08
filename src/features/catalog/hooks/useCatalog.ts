import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { Product } from '@/services/products/product-schemas';
import {
  normalizeProductFilters,
  productService,
  type ProductFilters,
} from '@/services/products/product-service';

export function useCatalog(filters: ProductFilters) {
  const normalized = normalizeProductFilters(filters);
  const query = useInfiniteQuery({
    queryKey: ['products', 'list', normalized],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      productService.list(normalized, pageParam, undefined, signal),
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.pagination.hasNext && lastPage.pagination.page >= lastPageParam
        ? lastPage.pagination.page + 1
        : undefined,
    staleTime: 30_000,
  });
  const products = useMemo(() => {
    const unique = new Map<number, Product>();
    for (const page of query.data?.pages ?? []) {
      for (const product of page.products) unique.set(product.id, product);
    }
    return [...unique.values()];
  }, [query.data]);
  return {
    ...query,
    products,
    filters: query.data?.pages[0]?.filters,
    pagination: query.data?.pages.at(-1)?.pagination,
  };
}
