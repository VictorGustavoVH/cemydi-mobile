import type { Product, ProductList } from './product-schemas';
import { productService, type ProductFilters } from './product-service';

export interface ProductRepository {
  list(
    filters: ProductFilters,
    page?: number,
    pageSize?: number,
    signal?: AbortSignal,
  ): Promise<ProductList>;
  detail(id: string, signal?: AbortSignal): Promise<{ product: Product }>;
  recommendations(id: string, signal?: AbortSignal): Promise<{ recommendations: Product[] }>;
}
// Repository-Separa las consultas de datos del producto de las pantallas.
export function createProductRepository(
  source: ProductRepository = productService,
): ProductRepository {
  return {
    list: (filters, page, pageSize, signal) => source.list(filters, page, pageSize, signal),
    detail: (id, signal) => source.detail(id, signal),
    recommendations: (id, signal) => source.recommendations(id, signal),
  };
}

export const productRepository: ProductRepository = createProductRepository();
