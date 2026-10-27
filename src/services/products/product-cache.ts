import type { QueryClient } from '@tanstack/react-query';
import type { Product } from './product-schemas';
import { productRepository } from './product-repository';

/**
 * Clave canónica del detalle público. La comparten la consulta del detalle y
 * las pantallas que dejan el producto listo antes de navegar.
 */
export const productDetailKey = (productId: string | number) =>
  ['products', 'detail', String(productId)] as const;

/**
 * Deja en caché el producto completo que una pantalla ya recibió para que el
 * detalle lo pinte en su primer frame: sin skeleton no hay estructura que
 * reemplazar después, así que el contenido ya visible no se reacomoda.
 *
 * Nunca pisa datos más recientes: solo escribe cuando el origen es posterior al
 * que ya está guardado, de modo que una ficha consultada no retrocede al
 * listado. `updatedAt` conserva la frescura del origen y evita una reconsulta
 * inmediata que no aporta nada.
 */
export function seedProductDetail(
  queryClient: QueryClient,
  product: Product,
  sourceUpdatedAt = Date.now(),
) {
  const key = productDetailKey(product.id);
  const current = queryClient.getQueryState(key);
  if (current && current.dataUpdatedAt >= sourceUpdatedAt) return;
  queryClient.setQueryData(key, { product }, { updatedAt: sourceUpdatedAt });
}

/**
 * Calienta la caché del detalle cuando una pantalla conoce el id pero no tiene
 * el `Product` completo (búsqueda, recomendaciones o un toque antes de
 * navegar). Si ya existe cualquier dato, no lanza otra petición: el detalle
 * puede pintar de inmediato y su propia consulta decidirá si debe refrescar.
 */
export function prefetchProductDetail(queryClient: QueryClient, productId: string | number) {
  if (!/^[1-9]\d*$/.test(String(productId)) || !Number.isSafeInteger(Number(productId))) return;
  const key = productDetailKey(productId);
  if (queryClient.getQueryState(key)?.data !== undefined) return;
  void queryClient.prefetchQuery({
    queryKey: key,
    queryFn: ({ signal }) => productRepository.detail(String(productId), signal),
    staleTime: 30_000,
  });
}
