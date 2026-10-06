import { Text, View } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import type { HomeProduct } from '@/data/catalog-preview';
import { CatalogImage } from './CatalogImage';

type ProductCardProps = {
  product: HomeProduct;
  onPress: () => void;
  className?: string;
};

export function ProductCard({ className = '', product, onPress }: ProductCardProps) {
  return (
    <AppButton
      className={`w-full flex-col items-stretch justify-start overflow-hidden rounded-2xl border border-border/50 bg-white px-0 py-0 ${className}`}
      label={`${product.name}. ${product.caption}. ${product.price} ${product.priceSuffix ?? ''}. ${product.priceNote ?? ''}. Ver producto.`}
      onPress={onPress}
      variant="unstyled"
    >
      <View className="w-full">
        <View className="aspect-square w-full bg-white p-3">
          <CatalogImage label={product.name} source={product.image} />
        </View>
        <View className="gap-1 px-3 pb-4 pt-3">
          <Text className="font-sans text-xs text-secondary">{product.caption}</Text>
          <Text className="font-sans-semibold text-sm text-primary">{product.name}</Text>
          <View className="flex-row flex-wrap items-baseline gap-x-1 pt-1">
            <Text className="font-sans-bold text-xl text-brand-strong">{product.price}</Text>
            {product.priceSuffix ? (
              <Text className="font-sans text-xs text-secondary">{product.priceSuffix}</Text>
            ) : null}
          </View>
          {product.priceNote ? (
            <Text className="font-sans text-xs text-secondary">{product.priceNote}</Text>
          ) : null}
        </View>
      </View>
    </AppButton>
  );
}
