import { memo } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import Star from 'lucide-react-native/icons/star';

import { AppButton } from '@/components/ui/AppButton';
import type { HomeProduct } from '@/data/catalog-preview';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';
import type { ProductRatingState } from '@/hooks/useProductRatings';
import { colors } from '@/theme';
import { SkeletonBlock } from './Skeleton';
import { CatalogImage } from './CatalogImage';

type ProductCardProps = {
  product: HomeProduct;
  ratingState?: ProductRatingState;
  onPress: () => void;
  className?: string;
  throttleMs?: number;
};

export const ProductCard = memo(function ProductCard({
  className = '',
  product,
  ratingState,
  onPress,
  throttleMs = 750,
}: ProductCardProps) {
  const { fontScale } = useWindowDimensions();

  const handlePress = useThrottledCallback(onPress, throttleMs);

  const unavailable = product.unavailable === true;
  const hasPurchase = product.modes.includes('purchase');
  const hasRental = product.modes.includes('rental');

  const hasDiscount = !unavailable && Boolean(product.originalPrice && product.discountPercent);

  const acquisitionLabel =
    hasPurchase && hasRental ? 'Venta y renta' : hasRental ? 'Renta' : 'Venta';

  const priceLabel =
    hasPurchase && hasRental
      ? product.priceSuffix
        ? 'Precio de renta'
        : 'Precio de venta'
      : hasRental
        ? 'Precio de renta'
        : 'Precio de venta';

  // Valoraciones explícitas: una tarjeta sin resumen nunca inventa opiniones.
  const rating = ratingState ? ratingState.summary?.averageRating : product.rating;
  const reviewCount = ratingState ? ratingState.summary?.count : (product.reviewCount ?? 0);
  const ratingLabel =
    rating !== undefined
      ? `Calificación ${rating} de 5, ${reviewCount} opiniones`
      : ratingState?.isPaused
        ? 'Sin conexión'
        : ratingState?.isError
          ? 'Valoración no disponible'
          : ratingState?.isFetching
            ? 'Cargando valoración'
            : 'Sin valoraciones';

  const accessibilityLabel = [
    product.name,
    acquisitionLabel,
    product.caption,
    priceLabel,
    product.price,
    product.priceSuffix,
    hasDiscount ? `Antes ${product.originalPrice}` : '',
    hasDiscount ? `Descuento del ${product.discountPercent}%` : '',
    unavailable ? 'No disponible' : '',
    product.prescription ? 'Requiere receta' : '',
    ratingLabel,
    'Ver producto',
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <AppButton
      className={`w-full grow flex-col items-stretch justify-start overflow-hidden rounded-xl border border-[#e7edef] px-0 py-0 ${unavailable ? 'bg-[#f7f9f9]' : 'bg-white'} ${className} `}
      label={accessibilityLabel}
      onPress={handlePress}
      variant="unstyled"
    >
      <View className="w-full grow">
        {/* IMAGEN DEL PRODUCTO */}
        <View
          className="relative w-full overflow-hidden border-b border-[#fff] bg-[#fff]"
          style={{ aspectRatio: 1 }}
        >
          <View className="absolute inset-0 px-1 pb-1 pt-6">
            <CatalogImage
              label={product.name}
              source={product.image}
              blurhash={product.imageBlurhash}
              accessible={false}
              style={unavailable ? { opacity: 0.4 } : undefined}
            />
          </View>

          {/* ETIQUETAS DE ADQUISICIÓN */}
          <View className="absolute left-2 top-2 flex-row flex-wrap gap-1">
            {hasPurchase ? (
              <View className="rounded bg-[#258e8b] px-2 py-1">
                <Text className="font-sans-semibold text-[9px] uppercase tracking-wide text-white">
                  Venta
                </Text>
              </View>
            ) : null}

            {hasRental ? (
              <View className="rounded bg-[#2f6fa3] px-2 py-1">
                <Text className="font-sans-semibold text-[9px] uppercase tracking-wide text-white">
                  Renta
                </Text>
              </View>
            ) : null}
          </View>

          {/* PRODUCTO NO DISPONIBLE */}
          {unavailable ? (
            <View className="absolute bottom-2 left-2 rounded bg-white/95 px-2 py-1">
              <Text className="font-sans-semibold text-[10px] text-secondary">No disponible</Text>
            </View>
          ) : null}
        </View>

        {/* INFORMACIÓN DEL PRODUCTO */}
        <View className="grow p-3">
          {/* CAPTION Y CALIFICACIÓN */}
          <View className="mb-1 flex-row items-center justify-between gap-2">
            {/* CAPTION */}
            <Text
              numberOfLines={1}
              className="min-w-0 flex-1 font-sans-semibold text-[10px] uppercase tracking-wide text-[#667b84]"
            >
              {product.caption ?? ''}
            </Text>

            {/* ESTRELLA Y CALIFICACIÓN */}
            <View className="shrink-0 flex-row items-center gap-1">
              <Star
                aria-hidden
                size={13}
                color={rating ? colors.rating : colors.textSecondary}
                fill={rating ? colors.rating : 'none'}
                strokeWidth={1.5}
              />

              {rating !== undefined ? (
                <Text className="font-sans-semibold text-xs text-primary">{rating.toFixed(1)}</Text>
              ) : ratingState?.isFetching && !ratingState.isPaused ? (
                <SkeletonBlock className="h-3 w-7" />
              ) : (
                <Text className="font-sans text-[10px] text-secondary">{ratingLabel}</Text>
              )}
            </View>
          </View>

          {/* NOMBRE DEL PRODUCTO */}
          <Text
            numberOfLines={2}
            style={{ minHeight: 40 * fontScale }}
            className={`font-sans-semibold text-sm leading-5 ${
              unavailable ? 'text-secondary' : 'text-[#142734]'
            }`}
          >
            {product.name}
          </Text>

          {/* PRECIO Y PROMOCIONES */}
          <View className="mt-auto pt-3">
            {/* TIPO DE PRECIO */}
            <Text className="font-sans text-[11px] text-[#71858d]">{priceLabel}</Text>

            {/* PRECIO ORIGINAL */}
            {hasDiscount ? (
              <Text className="mt-1 font-sans text-xs text-[#84959b] line-through">
                {product.originalPrice}
              </Text>
            ) : null}

            {/* PRECIO ACTUAL */}
            <View className="mt-1 flex-row flex-wrap items-baseline gap-x-1">
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                className={`font-sans-bold text-lg ${
                  unavailable ? 'text-secondary' : 'text-[#172f38]'
                }`}
              >
                {product.price}
              </Text>

              {product.priceSuffix ? (
                <Text className="font-sans text-[10px] text-[#71858d]">{product.priceSuffix}</Text>
              ) : null}
            </View>

            {/* DESCUENTO */}
            {hasDiscount ? (
              <View className="mt-2 flex-row">
                <View className="rounded-full bg-[#e9f5f3] px-2 py-1">
                  <Text className="font-sans-semibold text-[10px] text-[#258e8b]">
                    -{product.discountPercent}%
                  </Text>
                </View>
              </View>
            ) : null}

            {/* RECETA MÉDICA */}
            {product.prescription ? (
              <Text className="mt-2 font-sans-medium text-[10px] text-[#667b84]">
                Requiere receta
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </AppButton>
  );
});
