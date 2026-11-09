import { useMemo } from 'react';
import { useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { productDetailKey } from '@/services/products/product-cache';
import { productRepository } from '@/services/products/product-repository';
import { toProductDetail } from '@/services/products/product-adapter';
import type { Product, ProductList, ProductOffer } from '@/services/products/product-schemas';

export function useProductDetail(
  productId: string,
  promotions: ProductOffer[] | undefined,
  offersReady: boolean,
) {
  const queryClient = useQueryClient();
  const cachedProduct = useMemo(() => {
    const direct = queryClient.getQueryState<{ product: Product }>(productDetailKey(productId));
    if (direct?.data) return { product: direct.data.product, updatedAt: direct.dataUpdatedAt };
    let newest: { product: Product; updatedAt: number } | undefined;
    const lists = queryClient.getQueriesData<InfiniteData<ProductList> | ProductList>({
      queryKey: ['products', 'list'],
    });
    const recommendations = queryClient.getQueriesData<{ recommendations: Product[] }>({
      queryKey: ['products', 'recommendations'],
    });
    for (const [key, data] of lists) {
      let product: Product | undefined;
      const pages = data ? ('pages' in data ? data.pages : [data]) : [];
      for (const page of pages) {
        product = page.products.find((item) => String(item.id) === productId);
        if (product) break;
      }
      const updatedAt = queryClient.getQueryState(key)?.dataUpdatedAt ?? 0;
      if (product && (!newest || updatedAt > newest.updatedAt)) newest = { product, updatedAt };
    }
    for (const [key, data] of recommendations) {
      const product = data?.recommendations.find((item) => String(item.id) === productId);
      const updatedAt = queryClient.getQueryState(key)?.dataUpdatedAt ?? 0;
      if (product && (!newest || updatedAt > newest.updatedAt)) newest = { product, updatedAt };
    }
    return newest;
  }, [productId, queryClient]);

  // DETALLES DEL PRODUCTO
  const query = useQuery({
    queryKey: productDetailKey(productId),
    queryFn: ({ signal }) => productRepository.detail(productId, signal),
    enabled: /^[1-9]\d*$/.test(productId) && Number.isSafeInteger(Number(productId)),
    staleTime: 30_000,
    initialData: () => cachedProduct && { product: cachedProduct.product },
    initialDataUpdatedAt: cachedProduct?.updatedAt,
  });

  const product = useMemo(
    () => (query.data && offersReady ? toProductDetail(query.data.product, promotions) : undefined),
    [query.data, promotions, offersReady],
  );
  return { query, product };
}
