import { memo } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import type { HomeProduct } from '@/data/catalog-preview';
import { CatalogImage } from './CatalogImage';

type ProductCardProps = {
  product: HomeProduct;
  onPress: () => void;
  className?: string;
};

export const ProductCard = memo(function ProductCard({
  className = '',
  product,
  onPress,
}: ProductCardProps) {
  const { fontScale } = useWindowDimensions();
  const unavailable = product.unavailable === true;
  const acquisitionLabel =
    product.modes.includes('purchase') && product.modes.includes('rental')
      ? 'Venta y renta'
      : product.modes.includes('rental')
        ? 'Renta'
        : 'Venta';
  const priceLabel =
    product.modes.length > 1 ? (product.priceSuffix ? 'Precio de renta' : 'Precio de venta') : '';
  return (
    <AppButton
      className={`w-full grow flex-col items-stretch justify-start overflow-hidden rounded-2xl border border-border/50 px-0 py-0 ${unavailable ? 'bg-surface-muted' : 'bg-white'} ${className}`}
      label={`${product.name}. ${acquisitionLabel}. ${product.caption}. ${priceLabel} ${product.price} ${product.priceSuffix ?? ''}. ${unavailable ? 'No disponible.' : ''} ${product.originalPrice ? `Antes ${product.originalPrice}. Oferta ${product.discountPercent}%.` : ''} ${product.prescription ? 'Requiere receta.' : ''} Ver producto.`}
      onPress={onPress}
      variant="unstyled"
    >
      <View className="w-full grow">
        <View
          className="w-full bg-surface-muted p-3"
          style={{ aspectRatio: 3 / 2, maxHeight: 160 }}
        >
          <CatalogImage
            label={product.name}
            source={product.image}
            blurhash={product.imageBlurhash}
            accessible={false}
            style={unavailable ? { opacity: 0.4 } : undefined}
          />
          <View
            className="absolute left-2 top-2 rounded-md border border-border/50 bg-white px-2 py-1"
            style={{ maxWidth: '90%' }}
          >
            <Text className="font-sans-semibold text-xs text-brand-strong">{acquisitionLabel}</Text>
          </View>
        </View>
        <View className="grow gap-1 p-3">
          {product.caption ? (
            <Text numberOfLines={1} className="font-sans text-xs text-secondary">
              {product.caption}
            </Text>
          ) : null}
          <Text
            numberOfLines={2}
            style={{ minHeight: 40 * fontScale }}
            className={`font-sans-semibold text-sm leading-5 ${unavailable ? 'text-secondary' : 'text-primary'}`}
          >
            {product.name}
          </Text>
          <View className="mt-auto pt-1">
            {priceLabel ? (
              <Text className="font-sans text-xs text-secondary">{priceLabel}</Text>
            ) : null}
            {product.originalPrice && !unavailable ? (
              <Text className="font-sans text-xs text-secondary line-through">
                {product.originalPrice}
              </Text>
            ) : null}
            <View className="flex-row flex-wrap items-baseline gap-x-1 pt-1">
              <Text
                className={`font-sans-bold text-lg ${unavailable ? 'text-secondary' : 'text-brand-strong'}`}
              >
                {product.price}
              </Text>
              {product.priceSuffix ? (
                <Text className="font-sans text-xs text-secondary">{product.priceSuffix}</Text>
              ) : null}
            </View>
          </View>
          <View className="pt-1">
            <Text
              className={`font-sans-medium text-xs ${unavailable ? 'text-secondary' : 'text-brand-strong'}`}
            >
              {unavailable
                ? 'No disponible'
                : product.discountPercent
                  ? `Oferta · ${product.discountPercent}%`
                  : product.prescription
                    ? 'Requiere receta'
                    : 'Disponible'}
            </Text>
          </View>
        </View>
      </View>
    </AppButton>
  );
});
