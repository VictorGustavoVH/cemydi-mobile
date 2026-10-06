import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Heart from 'lucide-react-native/icons/heart';
import Share2 from 'lucide-react-native/icons/share-2';
import ShoppingBag from 'lucide-react-native/icons/shopping-bag';
import ShoppingCart from 'lucide-react-native/icons/shopping-cart';
import Star from 'lucide-react-native/icons/star';
import X from 'lucide-react-native/icons/x';
import FileText from 'lucide-react-native/icons/file-text';
import { AppButton } from '@/components/ui/AppButton';
import { AppScreen } from '@/components/ui/AppScreen';
import { CatalogImage } from '@/components/ui/CatalogImage';
import { ProductCard } from '@/components/ui/ProductCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { getProductPreview, getRecommendationsPreview } from '@/data/product-detail-preview';
import {
  PREVIEW_CART_QUANTITY_LIMIT,
  useCatalogPreview,
  type PreviewCartItem,
} from '@/providers/catalog-preview-provider';
import { colors } from '@/theme';

type ProductDetailScreenProps = { productId: string; initialMode?: PreviewCartItem['mode'] };
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

export function ProductDetailScreen({ productId, initialMode }: ProductDetailScreenProps) {
  const router = useRouter();
  const { width, fontScale } = useWindowDimensions();
  const product = getProductPreview(productId);
  const { favorites, toggleFavorite, items, addItem } = useCatalogPreview();
  const [mode, setMode] = useState<PreviewCartItem['mode']>(
    initialMode && product?.modes.includes(initialMode)
      ? initialMode
      : (product?.modes[0] ?? 'purchase'),
  );
  const [section, setSection] = useState<'description' | 'characteristics'>('description');
  const [photoIndex, setPhotoIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [notice, setNotice] = useState('');
  const [sharing, setSharing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const carouselRef = useRef<ScrollView>(null);
  const thumbnailScrollRef = useRef<ScrollView>(null);
  const zoomCarouselRef = useRef<ScrollView>(null);
  const activePhotoIndexRef = useRef(0);
  const targetPhotoIndexRef = useRef<number | null>(null);
  const reviewsOffset = useRef(0);
  const contentOffset = useRef(0);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/inicio'));

  const centerThumbnail = (index: number) => {
    const itemWidth = 64 + 10;
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
    if (width <= 0) return;
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

  useEffect(() => {
    if (zoomed) {
      const timer = setTimeout(() => {
        zoomCarouselRef.current?.scrollTo({ x: photoIndex * width, animated: false });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [zoomed, photoIndex, width]);

  if (!product)
    return (
      <AppScreen edges={['top', 'bottom', 'left', 'right']}>
        <EmptyState
          title="Producto no encontrado"
          description="Vuelve al catálogo para elegir otro producto."
          actionLabel="Volver al catálogo"
          onAction={() => router.replace('/inicio')}
        />
      </AppScreen>
    );

  const favorite = favorites.includes(product.id);
  const rental = mode === 'rental';
  const price = rental ? product.rental?.price : product.price;
  const reviews = product.id === 'bed' || product.id === 'wheelchair' ? sampleReviews : [];
  const recommendations = getRecommendationsPreview(product);
  const compact = width < 350 || fontScale > 1.3;
  const cartCount = items.reduce((count, item) => count + item.quantity, 0);
  const atQuantityLimit = items.some(
    (item) =>
      item.productId === product.id &&
      item.mode === mode &&
      item.quantity >= PREVIEW_CART_QUANTITY_LIMIT,
  );
  const productImages = [product.image, product.image, product.image, product.image];

  async function shareProduct() {
    setSharing(true);
    try {
      await Share.share({
        title: product!.name,
        message: `${product!.name} · CEMYDI\nDisponible para ${product!.caption.toLowerCase()}.`,
      });
    } catch {
      setNotice('No se pudo compartir. Inténtalo de nuevo.');
    } finally {
      setSharing(false);
    }
  }

  return (
    <AppScreen edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View className="bg-white">
          <View className="flex-row items-center gap-2 px-4 pt-2">
            <AppButton
              hideLabel
              label="Volver"
              variant="ghost"
              className="h-11 w-11 rounded-full px-0 py-0"
              onPress={back}
              leftIcon={<ArrowLeft aria-hidden color={colors.textPrimary} size={24} />}
            />
            <View className="flex-1 flex-row items-center justify-end gap-1">
              <AppButton
                hideLabel
                label={favorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                accessibilityState={{ selected: favorite }}
                variant="ghost"
                className="h-11 w-11 rounded-full px-0 py-0"
                onPress={() => {
                  toggleFavorite(product.id);
                  setNotice(
                    favorite
                      ? 'Eliminado de favoritos.'
                      : 'Guardado en favoritos durante esta sesión.',
                  );
                }}
                leftIcon={
                  <Heart
                    aria-hidden
                    color={favorite ? '#EF4444' : colors.textPrimary}
                    fill={favorite ? '#EF4444' : 'none'}
                    size={24}
                  />
                }
              />
              <AppButton
                hideLabel
                label="Compartir producto"
                variant="ghost"
                loading={sharing}
                className="h-11 w-11 rounded-full px-0 py-0"
                onPress={() => void shareProduct()}
                leftIcon={
                  sharing ? undefined : <Share2 aria-hidden color={colors.textPrimary} size={22} />
                }
              />
            </View>
          </View>
          <ScrollView
            ref={carouselRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            className="aspect-square w-full"
            style={{ maxHeight: 360 }}
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
              <Pressable
                key={index}
                onPress={() => setZoomed(true)}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Ampliar foto ${index + 1} de ${product.name}`}
                style={{ width, aspectRatio: 1, maxHeight: 360, padding: 24 }}
                className="items-center justify-center"
              >
                <CatalogImage source={image} label={`${product.name}, foto ${index + 1}`} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <View
          className="gap-5 px-5 pt-4"
          onLayout={(event) => {
            contentOffset.current = event.nativeEvent.layout.y;
          }}
        >
          <ScrollView
            ref={thumbnailScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingRight: 16 }}
          >
            {productImages.map((image, index) => (
              <AppButton
                key={index}
                variant="unstyled"
                label={`Ver foto ${index + 1}`}
                accessibilityState={{ selected: photoIndex === index }}
                className={`h-16 w-16 rounded-xl border-2 bg-white p-1.5 ${
                  photoIndex === index ? 'border-brand' : 'border-border/60'
                }`}
                onPress={() => handleSelectPhoto(index)}
              >
                <CatalogImage source={image} label={`${product.name}, foto ${index + 1}`} compact />
              </AppButton>
            ))}
          </ScrollView>
          <View className="gap-2">
            <View className="flex-row items-center justify-between gap-3">
              <Text className="flex-1 font-sans-medium text-sm text-brand-strong" numberOfLines={1}>
                {product.category}
              </Text>
              <Pressable
                className="flex-row items-center gap-1.5 active:opacity-70"
                onPress={() =>
                  scrollRef.current?.scrollTo({
                    y: contentOffset.current + reviewsOffset.current,
                    animated: true,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={
                  reviews.length
                    ? `Calificación 4.5 de 5 estrellas, ${reviews.length} reseñas. Ver reseñas.`
                    : 'Sin reseñas'
                }
              >
                <Star
                  aria-hidden
                  color={reviews.length ? '#FACC15' : colors.textSecondary}
                  fill={reviews.length ? '#FACC15' : 'none'}
                  size={15}
                />
                <Text className="font-sans-semibold text-sm text-primary">
                  {reviews.length ? '4.5' : 'Sin reseñas'}
                </Text>
                {reviews.length ? (
                  <Text className="font-sans text-xs text-secondary">
                    ({reviews.length} {reviews.length === 1 ? 'reseña' : 'reseñas'})
                  </Text>
                ) : null}
              </Pressable>
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
                    setNotice('');
                  }}
                />
              ))}
            </View>
          ) : (
            <Text className="font-sans-medium text-sm text-secondary">
              {rental ? 'Disponible para renta' : 'Disponible para compra'}
            </Text>
          )}
          <View className="gap-2">
            <View className="flex-row flex-wrap items-baseline gap-2">
              <Text className="font-sans-bold text-3xl text-primary">
                {price ?? 'Consultar tarifa'}
              </Text>
              <Text className="font-sans text-sm text-secondary">
                {rental ? 'MXN / día' : 'MXN'}
              </Text>
            </View>
            <Text className="font-sans text-sm leading-5 text-secondary">
              {rental
                ? 'Selecciona las fechas y completa tu solicitud desde el carrito.'
                : 'Añade el producto al carrito para continuar con tu compra.'}
            </Text>
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
                    Requiere receta. Se adjunta desde el carrito.
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
            {reviews.length ? (
              <>
                <View className="flex-row items-baseline gap-2">
                  <Text className="font-sans-bold text-3xl text-primary">4.5</Text>
                  <Text className="font-sans text-sm text-secondary">de 5 · 2 reseñas</Text>
                </View>
                {reviews.map((review) => (
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
                            color={value <= review.rating ? '#FACC15' : colors.disabled}
                            fill={value <= review.rating ? '#FACC15' : 'none'}
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
                <View className="w-full items-center justify-center pt-2">
                  <AppButton
                    variant="ghost"
                    label="Ver más"
                    accessibilityLabel="Ver más reseñas"
                    className="self-center px-6 py-2.5"
                    labelClassName="font-sans-semibold text-base text-brand"
                    onPress={() => setNotice('Por ahora solo hay 2 reseñas disponibles.')}
                  />
                </View>
              </>
            ) : (
              <EmptyState
                title="Todavía no hay reseñas"
                description="Las opiniones aparecerán aquí cuando estén disponibles."
              />
            )}
          </View>
          <View className="gap-4">
            <Text accessibilityRole="header" className="font-sans-semibold text-xl text-primary">
              También te puede interesar
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingBottom: 4, alignItems: 'flex-start' }}
            >
              {recommendations.map((item) => (
                <View key={item.id} style={{ width: compact ? 210 : 170 }}>
                  <ProductCard
                    className="w-full"
                    product={item}
                    onPress={() =>
                      router.replace({ pathname: '/producto/[id]', params: { id: item.id } })
                    }
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </ScrollView>
      <Modal
        visible={zoomed}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomed(false)}
      >
        <View className="flex-1 justify-between bg-black/95">
          <View className="z-20 flex-row items-center justify-end px-5 pt-12">
            <AppButton
              hideLabel
              label="Cerrar vista ampliada"
              variant="ghost"
              className="h-11 w-11 rounded-full bg-white/10 px-0 py-0 active:bg-white/20"
              onPress={() => setZoomed(false)}
              leftIcon={<X aria-hidden color="#FFFFFF" size={24} />}
            />
          </View>
          <ScrollView
            ref={zoomCarouselRef}
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
            {productImages.map((image, index) => (
              <Pressable
                key={index}
                style={{ width }}
                className="flex-1 items-center justify-center p-4"
                onPress={() => setZoomed(false)}
                accessibilityLabel="Cerrar vista ampliada"
              >
                <View className="aspect-square max-h-[85%] w-full items-center justify-center">
                  <CatalogImage source={image} label={`${product.name}, foto ampliada`} />
                </View>
              </Pressable>
            ))}
          </ScrollView>
          <View className="pb-6" />
        </View>
      </Modal>
      <View className="gap-2 border-t border-border/40 bg-background px-5 pb-2 pt-3">
        {notice ? (
          <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-brand-strong">
            {notice}
          </Text>
        ) : null}
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
            disabled={!price || atQuantityLimit}
            leftIcon={<ShoppingBag aria-hidden color={colors.onBrand} size={20} />}
            onPress={() => {
              addItem(product.id, mode);
              setNotice(`${rental ? 'Renta' : 'Producto'} añadido al carrito.`);
            }}
          />
        </View>
      </View>
    </AppScreen>
  );
}
