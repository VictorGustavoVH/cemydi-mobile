import type { Product, ProductList } from './product-schemas';
import { productService, type ProductFilters } from './product-service';

/** Lecturas públicas de productos; transporte, validación y caché quedan fuera del contrato. */
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

/** La fuente puede sustituirse sin cambiar consumidores ni replicar el cliente HTTP. */
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
