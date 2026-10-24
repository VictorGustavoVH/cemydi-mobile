import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import ShoppingBag from 'lucide-react-native/icons/shopping-bag';
import ShoppingCart from 'lucide-react-native/icons/shopping-cart';
import Star from 'lucide-react-native/icons/star';
import X from 'lucide-react-native/icons/x';
import FileText from 'lucide-react-native/icons/file-text';
import { AppButton } from '@/components/ui/AppButton';
import { AppScreen } from '@/components/ui/AppScreen';
import { CatalogImage } from '@/components/ui/CatalogImage';
import { ProductCard } from '@/components/ui/ProductCard';
import { ProductDetailHeader } from './components/ProductDetailHeader';
import { recommendationCardWidth } from './components/recommendation-card-metrics';
import {
  PRODUCT_DETAIL_THUMBNAIL_GAP,
  PRODUCT_DETAIL_THUMBNAIL_SIZE,
  productDetailGalleryHeight,
} from './components/product-detail-layout';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { getProductPreview, getRecommendationsPreview } from '@/data/product-detail-preview';
import type { ProductDetailPreview } from '@/data/product-detail-preview';
import type { HomeProduct } from '@/data/catalog-preview';
import type { ProductReviews } from '@/services/products/product-schemas';
import {
  PREVIEW_CART_QUANTITY_LIMIT,
  type PreviewCartItem,
} from '@/providers/catalog-preview-provider';
import { useCatalogPreview } from '@/providers/catalog-preview-provider';
import { useProductRatings } from '@/hooks/useProductRatings';
import { prefetchProductDetail } from '@/services/products/product-cache';
import { colors } from '@/theme';
import { useToast, useToastScroll } from '@/hooks/useToast';
type ProductDetailScreenProps = {
  productId: string;
  initialMode?: PreviewCartItem['mode'];
  suppliedProduct?: ProductDetailPreview;
  remoteStatus?: ReactNode;
  suppliedReviews?: ProductReviews;
  suppliedRecommendations?: HomeProduct[];
  reviewsStatus?: ReactNode;
  recommendationsStatus?: ReactNode;
};
const sampleReviews = [
  {
    id: '1',
    author: 'Cliente A',
    rating: 5,
    text: 'La información del equipo me ayudó a elegir entre compra y renta.',
  },
  {
    id: '2',
    author: 'Cliente B',
    rating: 4,
    text: 'Me resultó útil revisar las características antes de añadirlo al carrito.',
  },
];
export function ProductDetailScreen(props: ProductDetailScreenProps) {
  // Remontar el contenido cuando cambia de producto, evitando setState en efectos.
  const identity = `${props.productId}:${props.suppliedProduct?.id ?? ''}:${props.initialMode ?? ''}`;
  return <ProductDetailContent key={identity} {...props} />;
}

function ProductDetailContent({
  productId,
  initialMode,
  suppliedProduct,
  remoteStatus,
  suppliedReviews,
  suppliedRecommendations,
  reviewsStatus,
  recommendationsStatus,
}: ProductDetailScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const onToastScroll = useToastScroll();
  const { width, fontScale } = useWindowDimensions();
  const galleryHeight = productDetailGalleryHeight(width);
  const product = suppliedProduct ?? getProductPreview(productId);
  const connected = suppliedProduct !== undefined;
  const productImages = useMemo(
    () =>
      product
        ? product.images?.length
          ? product.images
          : [
              {
                id: `${product.id}-primary`,
                source: product.image,
                blurhash: product.imageBlurhash,
              },
            ]
        : [],
    [product],
  );
  const recommendations = useMemo(
    () =>
      suppliedRecommendations ?? (product && !connected ? getRecommendationsPreview(product) : []),
    [product, connected, suppliedRecommendations],
  );
  const recommendationIds = useMemo(
    () => recommendations.map((item) => item.id),
    [recommendations],
  );
  const recommendationRatings = useProductRatings(recommendationIds);
  const { items, addItem } = useCatalogPreview();
  const [mode, setMode] = useState<PreviewCartItem['mode']>(
    initialMode && product?.modes.includes(initialMode)
      ? initialMode
      : (product?.modes[0] ?? 'purchase'),
  );
  const [section, setSection] = useState<'description' | 'characteristics'>('description');
  const [photoIndex, setPhotoIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const carouselRef = useRef<ScrollView>(null);
  const thumbnailScrollRef = useRef<ScrollView>(null);
  const zoomCarouselRef = useRef<ScrollView>(null);
  const activePhotoIndexRef = useRef(0);
  const targetPhotoIndexRef = useRef<number | null>(null);
  const reviewsOffset = useRef(0);
  const contentOffset = useRef(0);
  const centerThumbnail = (index: number) => {
    const itemWidth = PRODUCT_DETAIL_THUMBNAIL_SIZE + PRODUCT_DETAIL_THUMBNAIL_GAP;
    const targetX = Math.max(0, index * itemWidth - width / 2 + 32 + 20);
    thumbnailScrollRef.current?.scrollTo({ x: targetX, animated: true });
  };
  const handleSelectPhoto = (index: number) => {
    activePhotoIndexRef.current = index;
    targetPhotoIndexRef.current = index;
    setPhotoIndex(index);
    centerThumbnail(index);
    carouselRef.current?.scrollTo({ x: index * width, animated: true });
  };
  const handleCarouselScroll = (contentOffsetX: number) => {
    if (width <= 0 || productImages.length === 0) return;
    const newIndex = Math.min(
      Math.max(Math.round(contentOffsetX / width), 0),
      productImages.length - 1,
    );
    if (targetPhotoIndexRef.current !== null) {
      if (newIndex !== targetPhotoIndexRef.current) return;
      targetPhotoIndexRef.current = null;
    }
    if (newIndex !== activePhotoIndexRef.current) {
      activePhotoIndexRef.current = newIndex;
      setPhotoIndex(newIndex);
      centerThumbnail(newIndex);
    }
  };
  if (!product)
    return (
      <AppScreen edges={['top', 'bottom', 'left', 'right']}>
        <EmptyState
          title="Producto no encontrado"
          description="Vuelve al catálogo para elegir otro producto."
          actionLabel="Volver al catálogo"
          onAction={() => router.replace('/catalogo')}
        />
      </AppScreen>
    );
  const rental = mode === 'rental';
  const price = rental ? product.rental?.price : product.price;
  const reviews = connected
    ? (suppliedReviews?.reviews.map((review) => ({
        id: String(review.id),
        author: review.user.nombre,
        rating: review.rating,
        text: review.comment,
      })) ?? [])
    : product.id === 'bed' || product.id === 'wheelchair'
      ? sampleReviews
      : [];
  const averageRating = connected
    ? (suppliedReviews?.summary.averageRating ?? 0)
    : reviews.length
      ? 4.5
      : 0;
  const visibleReviews = showAllReviews ? reviews : reviews.slice(0, 2);
  const compact = width < 350 || fontScale > 1.3;
  const cartCount = items.reduce((count, item) => count + item.quantity, 0);
  const atQuantityLimit = items.some(
    (item) =>
      item.productId === product.id &&
      item.mode === mode &&
      item.quantity >= PREVIEW_CART_QUANTITY_LIMIT,
  );
  return (
    <AppScreen edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView
        ref={scrollRef}
        onScroll={onToastScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        contentInsetAdjustmentBehavior="never"
      >
        <View className="bg-white">
          <ProductDetailHeader
            productId={product.id}
            productName={product.name}
            productCaption={product.caption}
            fallbackHref={connected ? '/catalogo' : '/inicio'}
          />
          <ScrollView
            ref={carouselRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            className="aspect-square w-full"
            style={{ height: galleryHeight }}
            scrollEventThrottle={16}
            onScrollBeginDrag={() => {
              targetPhotoIndexRef.current = null;
            }}
            onScroll={(event) => {
              handleCarouselScroll(event.nativeEvent.contentOffset.x);
            }}
            onMomentumScrollEnd={(event) => {
              handleCarouselScroll(event.nativeEvent.contentOffset.x);
            }}
          >
            {productImages.map((image, index) => (
              <AppButton
                variant="unstyled"
                label={`Ampliar foto ${index + 1} de ${product.name}`}
                key={image.id}
                onPress={() => setZoomed(true)}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Ampliar foto ${index + 1} de ${product.name}`}
                style={{ width, height: galleryHeight, padding: 24 }}
                className="items-center justify-center"
              >
                <CatalogImage
                  source={image.source}
                  blurhash={image.blurhash}
                  label={`${product.name}, foto ${index + 1}`}
                />
              </AppButton>
            ))}
          </ScrollView>
        </View>
        <View
          className="gap-5 px-5 pt-4"
          onLayout={(event) => {
            contentOffset.current = event.nativeEvent.layout.y;
          }}
        >
          {remoteStatus}
          <ScrollView
            ref={thumbnailScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: PRODUCT_DETAIL_THUMBNAIL_GAP, paddingRight: 16 }}
          >
            {productImages.map((image, index) => (
              <AppButton
                key={image.id}
                variant="unstyled"
                label={`Ver foto ${index + 1}`}
                accessibilityState={{ selected: photoIndex === index }}
                style={{
                  width: PRODUCT_DETAIL_THUMBNAIL_SIZE,
                  height: PRODUCT_DETAIL_THUMBNAIL_SIZE,
                }}
                className={`rounded-xl border-2 bg-white p-1.5 ${
                  photoIndex === index ? 'border-brand' : 'border-border/60'
                }`}
                onPress={() => handleSelectPhoto(index)}
              >
                <CatalogImage
                  source={image.source}
                  blurhash={image.blurhash}
                  label={`${product.name}, foto ${index + 1}`}
                  compact
                />
              </AppButton>
            ))}
          </ScrollView>
          <View className="gap-2">
            {/* Categoría y calificación, siempre en una sola fila */}
            <View className="min-h-11 flex-row items-center justify-between gap-2">
              <Text
                numberOfLines={1}
                className="min-w-0 flex-1 font-sans-medium text-sm text-brand-strong"
              >
                {product.category}
              </Text>
              {!connected || suppliedReviews ? (
                <AppButton
                  variant="unstyled"
                  label="Ver reseñas"
                  className="min-h-11 shrink-0 flex-row items-center justify-end gap-1 px-0 py-0"
                  onPress={() =>
                    scrollRef.current?.scrollTo({
                      y: contentOffset.current + reviewsOffset.current,
                      animated: true,
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={
                    reviews.length
                      ? `Calificación ${averageRating} de 5 estrellas, ${reviews.length} reseñas. Ver reseñas.`
                      : 'Sin reseñas. Ver reseñas.'
                  }
                >
                  <Star
                    aria-hidden
                    color={reviews.length ? colors.rating : colors.textSecondary}
                    fill={reviews.length ? colors.rating : 'none'}
                    size={15}
                  />
                  <Text numberOfLines={1} className="font-sans-semibold text-sm text-primary">
                    {reviews.length ? averageRating.toFixed(1) : 'Sin reseñas'}
                  </Text>
                  {reviews.length > 0 ? (
                    <Text numberOfLines={1} className="font-sans text-xs text-secondary">
                      ({reviews.length})
                    </Text>
                  ) : null}
                </AppButton>
              ) : (
                <View
                  className="min-h-11 shrink-0 flex-row items-center justify-end gap-1"
                  accessibilityLabel="Cargando calificación…"
                >
                  <SkeletonBlock className="h-4 w-4 rounded" />
                  <SkeletonBlock className="h-4 w-7 rounded" />
                  <SkeletonBlock className="h-3 w-6 rounded" />
                </View>
              )}
            </View>
            <Text
              accessibilityRole="header"
              className="font-sans-bold text-3xl tracking-tight text-primary"
            >
              {product.name}
            </Text>
          </View>
          {product.modes.length > 1 ? (
            <View
              className="flex-row gap-2 rounded-2xl bg-surface-muted p-1"
              accessibilityLabel="Modalidad de adquisición"
            >
              {product.modes.map((value) => (
                <AppButton
                  key={value}
                  label={value === 'purchase' ? 'Compra' : 'Renta'}
                  variant={mode === value ? 'primary' : 'ghost'}
                  accessibilityState={{ selected: mode === value }}
                  className="flex-1 rounded-xl"
                  onPress={() => {
                    setMode(value);
                  }}
                />
              ))}
            </View>
          ) : (
            <Text className="font-sans-medium text-sm text-secondary">
              {product.unavailable
                ? rental
                  ? 'Modalidad: renta'
                  : 'Modalidad: compra'
                : rental
                  ? 'Disponible para renta'
                  : 'Disponible para compra'}
            </Text>
          )}
          <View className="gap-2">
            {connected && !rental && product.prescription ? (
              <Text className="font-sans-medium text-sm text-brand-strong">Requiere receta</Text>
            ) : null}
            {product.unavailable ? (
              <Text className="font-sans-semibold text-base text-secondary">No disponible</Text>
            ) : null}
            {!rental && product.originalPrice && !product.unavailable ? (
              <Text className="font-sans text-sm text-secondary line-through">
                {product.originalPrice}
              </Text>
            ) : null}
            {!rental && product.discountPercent && !product.unavailable ? (
              <Text className="font-sans-semibold text-sm text-brand-strong">
                Oferta · {product.discountPercent}%
              </Text>
            ) : null}
            <View className="flex-row flex-wrap items-baseline gap-2">
              <Text className="font-sans-bold text-3xl text-primary">
                {price ?? 'Consultar tarifa'}
              </Text>
              <Text className="font-sans text-sm text-secondary">
                {rental ? 'MXN / día' : 'MXN'}
              </Text>
            </View>
            {!connected ? (
              <Text className="font-sans text-sm leading-5 text-secondary">
                {rental
                  ? 'Selecciona las fechas y completa tu solicitud desde el carrito.'
                  : 'Añade el producto al carrito para continuar con tu compra.'}
              </Text>
            ) : null}
          </View>
          <View className="gap-4">
            <View className="flex-row gap-2 border-b border-border/50 pb-3">
              <AppButton
                className="flex-1 rounded-full px-2"
                label="Descripción"
                variant={section === 'description' ? 'primary' : 'secondary'}
                accessibilityState={{ selected: section === 'description' }}
                onPress={() => setSection('description')}
              />
              <AppButton
                className="flex-1 rounded-full px-2"
                label="Características"
                variant={section === 'characteristics' ? 'primary' : 'secondary'}
                accessibilityState={{ selected: section === 'characteristics' }}
                onPress={() => setSection('characteristics')}
              />
            </View>
            {section === 'description' ? (
              <Text className="font-sans text-base leading-6 text-secondary">
                {product.description}
              </Text>
            ) : (
              <View>
                {product.characteristics.map((item) => (
                  <View
                    key={item.label}
                    className={`${compact ? 'gap-1' : 'flex-row gap-4'} border-b border-border/30 py-3`}
                  >
                    <Text className="flex-1 font-sans-medium text-sm text-primary">
                      {item.label}
                    </Text>
                    <Text className="flex-1 font-sans text-sm text-secondary">{item.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          {rental && product.rental ? (
            <View className="gap-3 rounded-2xl bg-surface-muted p-4">
              <Text
                accessibilityRole="header"
                className="font-sans-semibold text-base text-primary"
              >
                Antes de rentar
              </Text>
              <View className="flex-row flex-wrap gap-x-6 gap-y-3">
                <View className="gap-1">
                  <Text className="font-sans text-sm text-secondary">Renta mínima</Text>
                  <Text className="font-sans-semibold text-base text-primary">
                    {product.rental.minimum}
                  </Text>
                </View>
                <View className="gap-1">
                  <Text className="font-sans text-sm text-secondary">Depósito de garantía</Text>
                  <Text className="font-sans-semibold text-base text-primary">
                    {product.rental.deposit} MXN
                  </Text>
                </View>
              </View>
              <Text className="font-sans text-sm leading-6 text-secondary">
                {product.rental.terms}
              </Text>
              {product.prescription ? (
                <View className="flex-row items-start gap-2">
                  <FileText aria-hidden color={colors.brandStrong} size={20} />
                  <Text className="flex-1 font-sans-medium text-sm text-brand-strong">
                    {connected
                      ? 'Requiere receta.'
                      : 'Requiere receta. Se adjunta desde el carrito.'}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <View
            className="gap-4 border-t border-border/40 pt-5"
            onLayout={(event) => {
              reviewsOffset.current = event.nativeEvent.layout.y;
            }}
          >
            <Text accessibilityRole="header" className="font-sans-semibold text-xl text-primary">
              Reseñas
            </Text>
            {reviewsStatus}
            {reviews.length ? (
              <>
                <View className="flex-row items-baseline gap-2">
                  <Text className="font-sans-bold text-3xl text-primary">{averageRating}</Text>
                  <Text className="font-sans text-sm text-secondary">
                    de 5 · {reviews.length} {reviews.length === 1 ? 'reseña' : 'reseñas'}
                  </Text>
                </View>
                {visibleReviews.map((review) => (
                  <View key={review.id} className="gap-2 border-b border-border/30 pb-4">
                    <View className="flex-row flex-wrap items-center justify-between gap-2">
                      <Text className="font-sans-medium text-sm text-primary">{review.author}</Text>
                      <View
                        accessibilityLabel={`${review.rating} de 5 estrellas`}
                        className="flex-row gap-1"
                      >
                        {[1, 2, 3, 4, 5].map((value) => (
                          <Star
                            key={value}
                            aria-hidden
                            color={value <= review.rating ? colors.rating : colors.disabled}
                            fill={value <= review.rating ? colors.rating : 'none'}
                            size={14}
                          />
                        ))}
                      </View>
                    </View>
                    <Text className="font-sans text-sm leading-6 text-secondary">
                      {review.text}
                    </Text>
                  </View>
                ))}
                {reviews.length > 2 ? (
                  <View className="w-full items-center justify-center pt-2">
                    <AppButton
                      variant="ghost"
                      label={showAllReviews ? 'Ver menos' : 'Ver más'}
                      accessibilityLabel={showAllReviews ? 'Ver menos reseñas' : 'Ver más reseñas'}
                      className="self-center px-6 py-2.5"
                      labelClassName="font-sans-semibold text-base text-brand"
                      onPress={() => setShowAllReviews((current) => !current)}
                    />
                  </View>
                ) : null}
              </>
            ) : !connected || suppliedReviews ? (
              <EmptyState
                title="Todavía no hay reseñas"
                description="Las opiniones aparecerán aquí cuando estén disponibles."
              />
            ) : null}
          </View>
          {recommendations.length > 0 || connected ? (
            <View className="gap-4">
              <Text accessibilityRole="header" className="font-sans-semibold text-xl text-primary">
                También te puede interesar
              </Text>
              {recommendationsStatus}
              {connected && !recommendationsStatus && recommendations.length === 0 ? (
                <Text className="font-sans text-sm text-secondary">
                  No hay productos recomendados disponibles.
                </Text>
              ) : null}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingBottom: 4, alignItems: 'flex-start' }}
              >
                {recommendations.map((item) => (
                  <View key={item.id} style={{ width: recommendationCardWidth(compact) }}>
                    <ProductCard
                      className="w-full"
                      product={item}
                      ratingState={recommendationRatings[item.id]}
                      onPress={() => {
                        prefetchProductDetail(queryClient, item.id);
                        router.replace({ pathname: '/producto/[id]', params: { id: item.id } });
                      }}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </ScrollView>
      <Modal
        accessibilityViewIsModal
        visible={zoomed}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomed(false)}
      >
        <View accessibilityViewIsModal className="flex-1 justify-between bg-black/95">
          <View className="z-20 flex-row items-center justify-end px-5 pt-12">
            <AppButton
              hideLabel
              label="Cerrar vista ampliada"
              variant="ghost"
              className="h-11 w-11 rounded-full bg-white/10 px-0 py-0 active:bg-white/20"
              onPress={() => setZoomed(false)}
              leftIcon={<X aria-hidden color={colors.onBrand} size={24} />}
            />
          </View>
          <ScrollView
            ref={zoomCarouselRef}
            onLayout={() =>
              zoomCarouselRef.current?.scrollTo({ x: photoIndex * width, animated: false })
            }
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            className="flex-1"
            onMomentumScrollEnd={(event) => {
              const newIndex = Math.min(
                Math.max(Math.round(event.nativeEvent.contentOffset.x / width), 0),
                productImages.length - 1,
              );
              activePhotoIndexRef.current = newIndex;
              targetPhotoIndexRef.current = null;
              setPhotoIndex(newIndex);
              centerThumbnail(newIndex);
              carouselRef.current?.scrollTo({ x: newIndex * width, animated: false });
            }}
          >
            {zoomed
              ? productImages.map((image) => (
                  <AppButton
                    variant="unstyled"
                    label="Cerrar vista ampliada"
                    key={image.id}
                    style={{ width }}
                    className="flex-1 items-center justify-center p-4"
                    onPress={() => setZoomed(false)}
                    accessibilityLabel="Cerrar vista ampliada"
                  >
                    <View className="aspect-square max-h-[85%] w-full items-center justify-center">
                      <CatalogImage
                        source={image.source}
                        blurhash={image.blurhash}
                        label={`${product.name}, foto ampliada`}
                      />
                    </View>
                  </AppButton>
                ))
              : null}
          </ScrollView>
          <View className="pb-6" />
        </View>
      </Modal>
      <View className="gap-2 border-t border-border/40 bg-background px-5 pb-2 pt-3">
        <View className={compact ? 'gap-2' : 'flex-row items-center gap-3'}>
          <AppButton
            label={`Ver carrito${cartCount ? ` (${cartCount})` : ''}`}
            variant="outline"
            className="rounded-full"
            hideLabel={!compact}
            onPress={() => router.push('/carrito')}
            leftIcon={<ShoppingCart aria-hidden color={colors.brandStrong} size={22} />}
          />
          <AppButton
            label={
              atQuantityLimit
                ? 'Máximo 25 unidades en carrito'
                : rental
                  ? 'Añadir renta al carrito'
                  : 'Añadir al carrito'
            }
            className={`${compact ? '' : 'flex-1'} rounded-full`}
            disabled={
              !price || atQuantityLimit || product.unavailable || (rental && !product.rental)
            }
            leftIcon={<ShoppingBag aria-hidden color={colors.onBrand} size={20} />}
            onPress={() => {
              addItem(product.id, mode, connected ? product : undefined);
              toast.success('Producto agregado');
            }}
          />
        </View>
      </View>
    </AppScreen>
  );
}
