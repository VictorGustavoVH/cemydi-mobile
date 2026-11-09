import type { ComponentProps } from 'react';
import { ProductDetailScreen } from '@/features/products/ProductDetailScreen';
import { getProductPreview, getRecommendationsPreview } from '@/data/product-detail-preview';

/** Adaptador exclusivo de Jest: las rutas de producción nunca resuelven fixtures. */
export function PreviewProductDetailScreen(props: ComponentProps<typeof ProductDetailScreen>) {
  const product = getProductPreview(props.productId);
  return (
    <ProductDetailScreen
      {...props}
      suppliedProduct={product}
      suppliedRecommendations={product ? getRecommendationsPreview(product) : []}
    />
  );
}
