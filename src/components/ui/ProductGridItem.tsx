import { memo, useCallback } from 'react';
import { View } from 'react-native';
import type { CatalogMode, HomeProduct } from '@/data/catalog-preview';
import type { ProductRatingState } from '@/hooks/useProductRatings';
import { ProductCard } from './ProductCard';

type ProductGridItemProps = {
  product: HomeProduct;
  ratingState?: ProductRatingState;
  onOpen: (id: string, mode: CatalogMode | undefined) => void;
  width: number;
  marginHorizontal?: number;
  mode?: CatalogMode;
};

export const ProductGridItem = memo(function ProductGridItem({
  product,
  ratingState,
  onOpen,
  width,
  marginHorizontal = 0,
  mode = 'all',
}: ProductGridItemProps) {
  const onPress = useCallback(
    () => onOpen(product.id, mode === 'all' ? product.modes[0] : mode),
    [onOpen, product.id, product.modes, mode],
  );
  return (
    <View style={{ width, marginHorizontal }}>
      <ProductCard
        product={product}
        ratingState={ratingState}
        onPress={onPress}
        imageWidth={width}
      />
    </View>
  );
});

export function ProductGridSeparator() {
  return <View className="h-4" />;
}
