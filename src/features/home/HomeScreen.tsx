import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, Text, View, useWindowDimensions } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { AppButton } from '@/components/ui/AppButton';
import { AppRefreshControl } from '@/components/ui/AppRefreshControl';
import { AppScreen } from '@/components/ui/AppScreen';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProductGridSkeleton } from '@/components/ui/ProductGridSkeleton';
import { OfflineState } from '@/components/ui/OfflineState';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
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
import { useRouteCallback } from '@/hooks/useRouteCallback';
import { getFriendlyErrorMessage } from '@/services/http/api-error';
import { useToastScroll } from '@/hooks/useToast';
import { useProductOffers } from '@/hooks/useProductOffers';
import { useProductRatings, type ProductRatingState } from '@/hooks/useProductRatings';
import { withProductOffer } from '@/services/products/product-adapter';
import { prefetchProductDetail } from '@/services/products/product-cache';
import { HOME_PRODUCT_LIMIT } from '@/services/products/product-service';

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
  ratingState?: ProductRatingState;
  onOpen: (productId: string, mode: CatalogMode | undefined) => void;
};

const ProductItem = memo(function ProductItem({
  product,
  mode,
  ratingState,
  onOpen,
}: ProductItemProps) {
  const handlePress = useCallback(() => {
    onOpen(product.id, mode === 'all' ? product.modes[0] : mode);
  }, [onOpen, product.id, product.modes, mode]);
  return <ProductCard product={product} ratingState={ratingState} onPress={handlePress} />;
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
  const [preview, setPreview] = useState(false);
  const queryClient = useQueryClient();
  const { data, loading, isPending, error } = useHome();
  const offers = useProductOffers();
  const { isOnline } = useNetworkStatus();
  const homeProducts = useMemo(() => data?.products ?? [], [data]);
  const homeBanners = editorialBanners;
  const homeCategories = editorialCategories;
  const products = useMemo(
    () =>
      offers.ready
        ? homeProducts
            .slice(0, HOME_PRODUCT_LIMIT)
            .map((product) => withProductOffer(product, offers.data?.promotions))
        : [],
    [homeProducts, offers.data, offers.ready],
  );
  const productIds = useMemo(() => products.map((product) => product.id), [products]);
  const ratings = useProductRatings(productIds);

  const refresh = useCallback(
    () =>
      Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['home', 'products'] }),
        queryClient.invalidateQueries({ queryKey: ['promotions', 'active'] }),
      ]),
    [queryClient],
  );
  const { refreshing, onRefresh } = usePullToRefresh(refresh);
  const oneColumn = width < 350 || fontScale > 1.3;
  const columns = oneColumn ? 1 : 2;
  useLayoutEffect(() => {
    if (previousColumns.current !== columns) restoreScroll.current = true;
    previousColumns.current = columns;
  }, [columns]);

  const openProduct = useRouteCallback(
    (productId: string, productMode: CatalogMode | undefined) => {
      prefetchProductDetail(queryClient, productId);
      router.push({
        pathname: '/producto/[id]',
        params: { id: productId, mode: productMode },
      });
    },
    (id, mode) => `/producto/${id}?mode=${mode ?? ''}`,
  );

  const exploreSearch = useRouteCallback(
    (term: string) => {
      Keyboard.dismiss();
      router.navigate({ pathname: '/catalogo', params: { search: term, t: String(Date.now()) } });
    },
    (term) => `/catalogo?search=${term}`,
  );
  const explore = useCallback(() => exploreSearch(search.trim()), [exploreSearch, search]);
  const showProfile = useRouteCallback(
    () => {
      if (requestAccess('/perfil')) router.navigate('/perfil');
    },
    () => '/perfil',
  );
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
        <ProductItem
          product={item}
          mode="all"
          ratingState={ratings[item.id]}
          onOpen={openProduct}
        />
      </View>
    ),
    [columns, openProduct, ratings, width],
  );

  return (
    <AppScreen edges={['top', 'left', 'right']}>
      <FlatList
        accessibilityLabel="Contenido de inicio"
        ref={scrollRef}
        scrollEnabled={!suggestionsInteracting}
        onScrollBeginDrag={() => setSearchDismissSignal((signal) => signal + 1)}
        onScroll={(event) => {
          const offset = event.nativeEvent.contentOffset.y;
          if (!restoreScroll.current) scrollOffset.current = offset;
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
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <>
            <HomeHeader onNotifications={() => setPreview(true)} onProfile={showProfile} />
            <CatalogSearch
              dismissSignal={searchDismissSignal}
              onSuggestionsInteractionChange={setSuggestionsInteracting}
              onChange={setSearch}
              onFilters={() => {
                Keyboard.dismiss();
                router.navigate({
                  pathname: '/catalogo',
                  params: { search: search.trim(), filters: '1', t: String(Date.now()) },
                });
              }}
              onSelectProduct={(id) => openProduct(id, undefined)}
              onSubmit={exploreSearch}
              value={search}
            />

            {data && isOnline === false ? (
              <OfflineState description="Mostramos los productos cargados. Actualizaremos la información al recuperar la conexión." />
            ) : null}
            {error && data ? (
              <ErrorState description={getFriendlyErrorMessage(error)} onRetry={onRefresh} />
            ) : null}
            <>
              <Animated.View style={reducedMotion ? undefined : sectionReveal}>
                <BannerCarousel
                  banners={homeBanners}
                  onExplore={explore}
                  suspended={preview || search.length > 0}
                />
              </Animated.View>
              <Animated.View style={reducedMotion ? undefined : categoryReveal}>
                <CategoryCarousel
                  categories={homeCategories}
                  onSelect={(id) => {
                    const category = homeCategories.find((item) => item.id === id);
                    if (category)
                      router.navigate({
                        pathname: '/catalogo',
                        params: { search: category.label, t: String(Date.now()) },
                      });
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
                    onChange={(mode) =>
                      router.navigate({
                        pathname: '/catalogo',
                        params: { mode, t: String(Date.now()) },
                      })
                    }
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
          ) : isPending || (!data && loading) || (Boolean(data) && !offers.ready) ? (
            <ProductGridSkeleton columns={columns} count={HOME_PRODUCT_LIMIT} />
          ) : !data && error ? (
            <ErrorState description={getFriendlyErrorMessage(error)} onRetry={onRefresh} />
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
      <AppSheet onClose={() => setPreview(false)} title="Notificaciones" visible={preview}>
        <Text className="font-sans text-base leading-6 text-secondary">
          No tienes notificaciones en esta vista de muestra.
        </Text>
      </AppSheet>
    </AppScreen>
  );
}
