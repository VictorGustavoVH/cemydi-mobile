import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, RefreshControl, Text, View, useWindowDimensions } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton } from '@/components/ui/AppButton';
import { AppScreen } from '@/components/ui/AppScreen';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProductGridSkeleton } from '@/components/ui/ProductGridSkeleton';
import { OfflineState } from '@/components/ui/OfflineState';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { BannerCarousel } from './components/BannerCarousel';
import { CatalogModeFilter } from './components/CatalogModeFilter';
import { CatalogSearch } from '@/components/ui/CatalogSearch';
import { CategoryCarousel } from './components/CategoryCarousel';
import { HomeHeader } from './components/HomeHeader';
import { AppSheet } from '@/components/ui/AppSheet';
import { ProductCard } from '@/components/ui/ProductCard';
import type { CatalogMode, HomeProduct } from '@/data/catalog-preview';
import {
  homeBanners as editorialBanners,
  homeCategories as editorialCategories,
} from '@/data/catalog-preview';
import { useHome } from './hooks/useHome';
import { useAccountAccess } from '@/hooks/useAccountAccess';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';
import { getFriendlyErrorMessage } from '@/services/http/api-error';
import { useToastScroll } from '@/hooks/useToast';
import { colors } from '@/theme';
import { useProductOffers } from '@/hooks/useProductOffers';
import { withProductOffer } from '@/services/products/product-adapter';
import { HOME_PRODUCT_LIMIT } from '@/services/products/product-service';

type Preview = { kind: 'info'; title: string; description: string };
const productKey = (item: HomeProduct) => item.id;
// Reveal sections once their real content mounts; never animate recycled product rows.
const sectionReveal = {
  animationName: { from: { opacity: 0 }, to: { opacity: 1 } },
  animationDuration: 180,
  animationTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
  animationFillMode: 'both',
} as const;
const categoryReveal = { ...sectionReveal, animationDelay: 40 };
const filtersReveal = { ...sectionReveal, animationDelay: 80 };
function ProductSeparator() {
  return <View className="h-4" />;
}

type ProductItemProps = {
  product: HomeProduct;
  mode: CatalogMode;
  onOpen: (productId: string, mode: CatalogMode | undefined) => void;
};

const ProductItem = memo(function ProductItem({ product, mode, onOpen }: ProductItemProps) {
  const handlePress = useCallback(() => {
    onOpen(product.id, mode === 'all' ? product.modes[0] : mode);
  }, [onOpen, product.id, product.modes, mode]);
  return <ProductCard product={product} onPress={handlePress} />;
});

export function HomeScreen() {
  const router = useRouter();
  const { requestAccess } = useAccountAccess();
  const onToastScroll = useToastScroll();
  const scrollRef = useRef<FlatList<HomeProduct>>(null);
  const scrollOffset = useRef(0);
  const restoreScroll = useRef(false);
  const previousColumns = useRef(2);
  const reducedMotion = useReducedMotion();
  const { width, fontScale } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const [suggestionsInteracting, setSuggestionsInteracting] = useState(false);
  const [searchDismissSignal, setSearchDismissSignal] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const { data, loading, error, refetch } = useHome();
  const offers = useProductOffers();
  const { isOnline } = useNetworkStatus();
  const homeProducts = useMemo(() => data?.products ?? [], [data]);
  const homeBanners = editorialBanners;
  const homeCategories = editorialCategories;
  const products = useMemo(
    () =>
      homeProducts
        .slice(0, HOME_PRODUCT_LIMIT)
        .map((product) => withProductOffer(product, offers.data?.promotions)),
    [homeProducts, offers.data],
  );
  const oneColumn = width < 350 || fontScale > 1.3;
  const columns = oneColumn ? 1 : 2;
  useLayoutEffect(() => {
    if (previousColumns.current !== columns) restoreScroll.current = true;
    previousColumns.current = columns;
  }, [columns]);

  const openProduct = useThrottledCallback(
    (productId: string, productMode: CatalogMode | undefined) => {
      router.push({
        pathname: '/producto/[id]',
        params: { id: productId, mode: productMode },
      });
    },
    750,
  );

  const exploreSearch = useThrottledCallback((term: string) => {
    Keyboard.dismiss();
    router.push({ pathname: '/catalogo', params: { search: term } });
  }, 750);
  const explore = useCallback(() => exploreSearch(search.trim()), [exploreSearch, search]);
  const showProfile = useCallback(() => {
    if (!requestAccess('/perfil')) return;
    router.push('/perfil');
  }, [requestAccess, router]);
  // Acciones pedidas por la barra global (Inicio/Explorar) via params.
  const params = useLocalSearchParams<{ action?: 'top' | 'explore'; t?: string }>();
  const lastActionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!params.action || !params.t || lastActionRef.current === params.t) return;
    lastActionRef.current = params.t;
    if (params.action === 'top') {
      scrollRef.current?.scrollToOffset({ offset: 0, animated: !reducedMotion });
    } else if (params.action === 'explore') {
      explore();
    }
  }, [params.action, params.t, explore, reducedMotion]);

  const renderProduct = useCallback(
    ({ item }: { item: HomeProduct }) => (
      <View
        style={{
          width: (width - 40 - (columns - 1) * 12) / columns,
          marginHorizontal: columns === 1 ? 20 : 0,
        }}
      >
        <ProductItem product={item} mode="all" onOpen={openProduct} />
      </View>
    ),
    [columns, openProduct, width],
  );
  const sheetTitle = preview?.title ?? '';

  return (
    <AppScreen edges={['top', 'left', 'right']}>
      <FlatList
        accessibilityLabel="Contenido de inicio"
        ref={scrollRef}
        scrollEnabled={!suggestionsInteracting}
        onScrollBeginDrag={() => setSearchDismissSignal((signal) => signal + 1)}
        onScroll={(event) => {
          if (!restoreScroll.current) scrollOffset.current = event.nativeEvent.contentOffset.y;
          onToastScroll(event);
        }}
        onContentSizeChange={() => {
          if (restoreScroll.current) {
            scrollRef.current?.scrollToOffset({ offset: scrollOffset.current, animated: false });
            restoreScroll.current = false;
          }
        }}
        scrollEventThrottle={16}
        key={oneColumn ? 'one' : 'two'}
        data={products}
        renderItem={renderProduct}
        keyExtractor={productKey}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: 12, paddingHorizontal: 20 } : undefined}
        ItemSeparatorComponent={ProductSeparator}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading && data !== null}
            onRefresh={refetch}
            tintColor={colors.brandStrong}
            colors={[colors.brandStrong]}
            progressBackgroundColor={colors.surface}
          />
        }
        ListHeaderComponent={
          <>
            <HomeHeader
              onNotifications={() =>
                setPreview({
                  kind: 'info',
                  title: 'Notificaciones',
                  description: 'No tienes notificaciones en esta vista de muestra.',
                })
              }
              onProfile={showProfile}
            />
            <CatalogSearch
              dismissSignal={searchDismissSignal}
              onSuggestionsInteractionChange={setSuggestionsInteracting}
              onChange={setSearch}
              onFilters={() => {
                Keyboard.dismiss();
                router.push({
                  pathname: '/catalogo',
                  params: { search: search.trim(), filters: '1' },
                });
              }}
              onSelectProduct={(productId) => {
                router.push({
                  pathname: '/producto/[id]',
                  params: { id: productId },
                });
              }}
              onSubmit={exploreSearch}
              value={search}
            />

            {data && isOnline === false ? (
              <OfflineState description="Mostramos los productos cargados. Actualizaremos la información al recuperar la conexión." />
            ) : null}
            {error && data ? <ErrorState description={error.message} onRetry={refetch} /> : null}
            <>
              <Animated.View style={reducedMotion ? undefined : sectionReveal}>
                <BannerCarousel
                  banners={homeBanners}
                  onExplore={explore}
                  suspended={preview !== null || search.length > 0}
                />
              </Animated.View>
              <Animated.View style={reducedMotion ? undefined : categoryReveal}>
                <CategoryCarousel
                  categories={homeCategories}
                  onSelect={(id) => {
                    const category = homeCategories.find((item) => item.id === id);
                    if (category)
                      router.push({ pathname: '/catalogo', params: { search: category.label } });
                  }}
                  selectedId={null}
                />
              </Animated.View>
              <Animated.View
                style={reducedMotion ? undefined : filtersReveal}
                className="gap-4 px-5 pt-4"
              >
                <View className="gap-2">
                  <Text
                    accessibilityRole="header"
                    className="font-sans-semibold text-lg tracking-tight text-primary"
                  >
                    Filtros
                  </Text>
                  <CatalogModeFilter
                    onChange={(mode) => router.push({ pathname: '/catalogo', params: { mode } })}
                    value="all"
                  />
                </View>
                <View className="flex-row items-center justify-between gap-2">
                  <Text
                    accessibilityRole="header"
                    className="flex-1 font-sans-semibold text-lg tracking-tight text-primary"
                  >
                    Para tu bienestar
                  </Text>
                  <AppButton
                    className="px-1 py-2"
                    label="Ver más"
                    labelClassName="text-xs text-brand-strong"
                    onPress={explore}
                    variant="ghost"
                  />
                </View>
              </Animated.View>
              <View className="h-4" />
            </>
          </>
        }
        ListEmptyComponent={
          !data && isOnline === false ? (
            <OfflineState />
          ) : !data && loading ? (
            <ProductGridSkeleton columns={columns} />
          ) : !data && error ? (
            <ErrorState description={getFriendlyErrorMessage(error)} onRetry={refetch} />
          ) : (
            <View className="px-5">
              <View className="items-center gap-3 rounded-2xl bg-surface-muted px-5 py-8">
                <Text className="text-center font-sans-semibold text-lg text-primary">
                  No encontramos productos
                </Text>
                <Text className="text-center font-sans text-sm text-secondary">
                  Prueba otra búsqueda o cambia los filtros.
                </Text>
                <AppButton label="Ver catálogo" onPress={explore} variant="outline" />
              </View>
            </View>
          )
        }
        ListFooterComponent={
          data ? (
            <View className="gap-3 px-5 pt-6">
              {offers.isError && isOnline !== false ? (
                <ErrorState
                  title="No pudimos consultar las ofertas"
                  description="Se muestran los precios base de los productos."
                  onRetry={() => void offers.refetch()}
                />
              ) : null}
              <AppButton label="Ver catálogo completo" onPress={explore} variant="outline" />
            </View>
          ) : null
        }
      />
      <AppSheet onClose={() => setPreview(null)} title={sheetTitle} visible={preview !== null}>
        {preview?.kind === 'info' ? (
          <Text className="font-sans text-base leading-6 text-secondary">
            {preview.description}
          </Text>
        ) : null}
      </AppSheet>
    </AppScreen>
  );
}
