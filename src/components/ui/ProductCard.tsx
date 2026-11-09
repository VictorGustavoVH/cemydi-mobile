import { memo, useState } from 'react';
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
  /** Ancho ya medido por la cuadrícula o el carrusel. */
  imageWidth?: number;
};

export const ProductCard = memo(function ProductCard({
  className = '',
  product,
  ratingState,
  onPress,
  throttleMs = 750,
  imageWidth,
}: ProductCardProps) {
  const { fontScale } = useWindowDimensions();
  const [cardWidth, setCardWidth] = useState<number>();
  const imageHeight = Math.min(160, Math.max(0, ((imageWidth ?? cardWidth ?? 240) * 2) / 3));

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
      className={`w-full grow flex-col items-stretch justify-start overflow-hidden rounded-xl border border-border-subtle px-0 py-0 ${unavailable ? 'bg-surface-muted' : 'bg-surface'} ${className} `}
      label={accessibilityLabel}
      onPress={handlePress}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (imageWidth === undefined && nextWidth > 0)
          setCardWidth((current) => (current === nextWidth ? current : nextWidth));
      }}
      variant="unstyled"
    >
      <View className="w-full grow">
        {/* ETIQUETAS DE ADQUISICIÓN */}
        <View className="flex-row flex-wrap gap-1 p-2">
          {hasPurchase ? (
            <View className="rounded bg-brand-strong px-2 py-1">
              <Text className="font-sans-semibold text-sm uppercase tracking-wide text-on-brand">
                Venta
              </Text>
            </View>
          ) : null}

          {hasRental ? (
            <View className="rounded bg-rental px-2 py-1">
              <Text className="font-sans-semibold text-sm uppercase tracking-wide text-on-brand">
                Renta
              </Text>
            </View>
          ) : null}
        </View>

        {/* Altura concreta para expo-image; no depende de porcentajes en una capa absoluta. */}
        <View className="w-full bg-surface" style={{ height: imageHeight, maxHeight: 160 }}>
          <CatalogImage
            label={product.name}
            source={product.image}
            blurhash={product.imageBlurhash}
            accessible={false}
            contentFit="contain"
            style={{ width: '100%', height: imageHeight, backgroundColor: colors.surface }}
          />
        </View>

        {/* INFORMACIÓN DEL PRODUCTO */}
        <View className="grow p-3">
          {/* PRODUCTO NO DISPONIBLE */}
          {unavailable ? (
            <View className="self-start rounded bg-surface-muted px-2 py-1">
              <Text className="font-sans-semibold text-sm text-secondary">No disponible</Text>
            </View>
          ) : null}
          <View className="mb-1 flex-row items-start justify-between gap-2">
            <Text className="min-w-0 flex-1 font-sans-semibold text-sm uppercase tracking-wide text-secondary">
              {product.caption ?? ''}
            </Text>
            <View style={{ flexShrink: 1, alignItems: 'flex-end', marginLeft: 'auto' }}>
              <View className="max-w-full flex-row flex-wrap items-center justify-end gap-1">
                <Star
                  aria-hidden
                  size={13}
                  color={rating ? colors.rating : colors.textSecondary}
                  fill={rating ? colors.rating : 'none'}
                  strokeWidth={1.5}
                />

                {rating !== undefined ? (
                  <Text className="font-sans-semibold text-sm text-primary">
                    {rating.toFixed(1)}
                  </Text>
                ) : ratingState?.isFetching && !ratingState.isPaused ? (
                  <SkeletonBlock className="h-3 w-7" />
                ) : (
                  <Text className="shrink text-right font-sans text-sm text-secondary">
                    {ratingLabel}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* NOMBRE DEL PRODUCTO */}
          <Text
            numberOfLines={2}
            style={{ minHeight: 40 * fontScale }}
            className={`font-sans-semibold text-sm leading-5 ${
              unavailable ? 'text-secondary' : 'text-primary'
            }`}
          >
            {product.name}
          </Text>

          {/* PRECIO Y PROMOCIONES */}
          <View className="pt-3">
            {/* TIPO DE PRECIO */}
            <Text className="font-sans text-sm text-secondary">{priceLabel}</Text>

            {/* PRECIO ORIGINAL */}
            {hasDiscount ? (
              <Text className="mt-1 font-sans text-sm text-secondary line-through">
                {product.originalPrice}
              </Text>
            ) : null}

            {/* PRECIO ACTUAL */}
            <View className="mt-1 flex-row flex-wrap items-baseline gap-x-1">
              <Text
                className={`max-w-full shrink font-sans-bold text-lg ${
                  unavailable ? 'text-secondary' : 'text-primary'
                }`}
              >
                {product.price}
              </Text>

              {product.priceSuffix ? (
                <Text className="font-sans text-sm text-secondary">{product.priceSuffix}</Text>
              ) : null}
            </View>

            {/* DESCUENTO */}
            {hasDiscount ? (
              <View className="mt-2 flex-row">
                <View className="rounded-full bg-brand-muted px-2 py-1">
                  <Text className="font-sans-semibold text-sm text-brand-strong">
                    -{product.discountPercent}%
                  </Text>
                </View>
              </View>
            ) : null}

            {/* RECETA MÉDICA */}
            {product.prescription ? (
              <Text className="mt-2 font-sans-medium text-sm text-secondary">Requiere receta</Text>
            ) : null}
          </View>
        </View>
      </View>
    </AppButton>
  );
});
