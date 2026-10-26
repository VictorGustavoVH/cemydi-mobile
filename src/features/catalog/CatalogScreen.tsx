import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { AppButton } from '@/components/ui/AppButton';
import { AppRefreshControl } from '@/components/ui/AppRefreshControl';
import { AppScreen } from '@/components/ui/AppScreen';
import { BackButton } from '@/components/ui/BackButton';
import { CatalogSearch } from '@/components/ui/CatalogSearch';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { OfflineState } from '@/components/ui/OfflineState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ProductCard } from '@/components/ui/ProductCard';
import { ProductGridSkeleton } from '@/components/ui/ProductGridSkeleton';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useProductOffers } from '@/hooks/useProductOffers';
import { useProductRatings, type ProductRatingState } from '@/hooks/useProductRatings';
import { useRouteCallback } from '@/hooks/useRouteCallback';
import { useToastScroll } from '@/hooks/useToast';
import { toProductCard } from '@/services/products/product-adapter';
import { prefetchProductDetail, seedProductDetail } from '@/services/products/product-cache';
import { emptyProductFilters, type ProductFilters } from '@/services/products/product-service';
import type { HomeProduct } from '@/data/catalog-preview';
import { getFriendlyErrorMessage } from '@/services/http/api-error';
import { useCatalog } from './hooks/useCatalog';
import { CatalogFiltersSheet } from './components/CatalogFiltersSheet';
import { CatalogQuickFilters } from './components/CatalogQuickFilters';

const productKey = (item: HomeProduct) => item.id;
function ProductSeparator() {
  return <View className="h-4" />;
}
const CatalogItem = memo(function CatalogItem({
  product,
  ratingState,
  onOpen,
  width,
}: {
  product: HomeProduct;
  ratingState?: ProductRatingState;
  onOpen: (id: string) => void;
  width: number;
}) {
  return (
    <View style={{ width }}>
      <ProductCard product={product} ratingState={ratingState} onPress={() => onOpen(product.id)} />
    </View>
  );
});

export function CatalogScreen() {
  const params = useLocalSearchParams<{
    search?: string;
    clasificacion?: string;
    mode?: string;
    filters?: string;
    t?: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width, fontScale } = useWindowDimensions();
  const columns = width < 350 || fontScale > 1.3 ? 1 : 2;
  const list = useRef<FlatList<HomeProduct>>(null);
  const onToastScroll = useToastScroll();
  const { isOnline } = useNetworkStatus();
  const [search, setSearch] = useState(params.search?.slice(0, 120) ?? '');
  const [filters, setFilters] = useState<ProductFilters>(() => ({
    ...emptyProductFilters,
    search: params.search?.slice(0, 120) ?? '',
    clasificaciones: params.clasificacion ? [params.clasificacion] : [],
    tipos:
      params.mode === 'purchase'
        ? ['VENTA', 'MIXTO']
        : params.mode === 'rental'
          ? ['RENTA', 'MIXTO']
          : [],
  }));
  const [sheetOpen, setSheetOpen] = useState(params.filters === '1');
  const [suggestionsInteracting, setSuggestionsInteracting] = useState(false);
  const [searchDismissSignal, setSearchDismissSignal] = useState(0);
  const incoming = JSON.stringify([
    params.search,
    params.clasificacion,
    params.mode,
    params.filters,
    params.t,
  ]);
  const lastIncoming = useRef(incoming);
  useFocusEffect(
    useCallback(() => {
      if (lastIncoming.current === incoming) return;
      lastIncoming.current = incoming;
      setSearch(params.search?.slice(0, 120) ?? '');
      setFilters({
        ...emptyProductFilters,
        search: params.search?.slice(0, 120) ?? '',
        clasificaciones: params.clasificacion ? [params.clasificacion] : [],
        tipos:
          params.mode === 'purchase'
            ? ['VENTA', 'MIXTO']
            : params.mode === 'rental'
              ? ['RENTA', 'MIXTO']
              : [],
      });
      setSheetOpen(params.filters === '1');
    }, [incoming, params.search, params.clasificacion, params.mode, params.filters]),
  );
  const query = useCatalog(filters);
  const offers = useProductOffers();

  const refresh = useCallback(
    () => Promise.allSettled([query.refetch(), offers.refetch()]),
    [query, offers],
  );
  const { refreshing, onRefresh } = usePullToRefresh(refresh);
  useEffect(() => {
    const timeout = setTimeout(
      () =>
        setFilters((current) =>
          current.search === search.trim() ? current : { ...current, search: search.trim() },
        ),
      search.trim() === '' ? 0 : 350,
    );
    return () => clearTimeout(timeout);
  }, [search]);
  const isFirstMount = useRef(true);
  const prevFiltersRef = useRef(filters);
  const prevColumnsRef = useRef(columns);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    const filtersChanged = prevFiltersRef.current !== filters;
    const columnsChanged = prevColumnsRef.current !== columns;
    prevFiltersRef.current = filters;
    prevColumnsRef.current = columns;
    if (filtersChanged || columnsChanged) {
      list.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [filters, columns]);
  const mode =
    filters.tipos.includes('RENTA') && !filters.tipos.includes('VENTA') ? 'rental' : 'all';
  // Las tarjetas cambian de alto cuando aparece la oferta, así que la cuadrícula
  // espera a conocer las promociones en lugar de reacomodarse después.
  const products = useMemo(
    () =>
      offers.ready
        ? query.products.map((product) => toProductCard(product, offers.data?.promotions, mode))
        : [],
    [query.products, offers.data, offers.ready, mode],
  );
  const productIds = useMemo(() => products.map((product) => product.id), [products]);
  const ratings = useProductRatings(productIds);
  const openProduct = useRouteCallback(
    (id: string) => {
      const rawProduct = query.products.find((product) => String(product.id) === id);
      if (rawProduct) seedProductDetail(queryClient, rawProduct, query.dataUpdatedAt);
      prefetchProductDetail(queryClient, id);
      router.push({
        pathname: '/producto/[id]',
        params: { id, mode: mode === 'all' ? undefined : mode },
      });
    },
    (id) => `/producto/${id}?mode=${mode === 'all' ? '' : mode}`,
  );
  const renderProduct = useCallback(
    ({ item }: { item: HomeProduct }) => (
      <View style={{ marginHorizontal: columns === 1 ? 20 : 0 }}>
        <CatalogItem
          product={item}
          ratingState={ratings[item.id]}
          onOpen={openProduct}
          width={(width - 40 - (columns - 1) * 12) / columns}
        />
      </View>
    ),
    [openProduct, ratings, width, columns],
  );
  const clear = () => {
    setSearch('');
    setFilters(emptyProductFilters);
  };
  const hasFilters =
    filters.clasificaciones.length > 0 ||
    filters.marcas.length > 0 ||
    filters.tipos.length > 0 ||
    filters.requiereReceta !== null ||
    filters.soloDisponibles ||
    filters.sort !== 'reciente';
  const updateFilters = (next: ProductFilters) => {
    setSearchDismissSignal((signal) => signal + 1);
    Keyboard.dismiss();
    setFilters({ ...next, search: search.trim() });
  };
  return (
    <AppScreen edges={['top', 'left', 'right']}>
      <FlatList
        ref={list}
        scrollEnabled={!suggestionsInteracting}
        onScrollBeginDrag={() => setSearchDismissSignal((signal) => signal + 1)}
        accessibilityLabel="Productos del catálogo"
        accessibilityElementsHidden={sheetOpen}
        importantForAccessibility={sheetOpen ? 'no-hide-descendants' : 'auto'}
        key={columns}
        numColumns={columns}
        data={products}
        keyExtractor={productKey}
        renderItem={renderProduct}
        columnWrapperStyle={columns > 1 ? { gap: 12, paddingHorizontal: 20 } : undefined}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        ItemSeparatorComponent={ProductSeparator}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        keyboardDismissMode="on-drag"
        onScroll={onToastScroll}
        onEndReached={() => {
          if (
            query.hasNextPage &&
            !query.isFetching &&
            !query.isFetchNextPageError &&
            isOnline !== false &&
            filters.search === search.trim()
          ) {
            void query.fetchNextPage({ cancelRefetch: false });
          }
        }}
        onEndReachedThreshold={0.5}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <>
            <View className="flex-row items-center gap-3 px-5 py-2">
              <BackButton fallbackHref="/inicio" onPress={() => router.navigate('/inicio')} />
              <View className="flex-1 items-center gap-0.5">
                <Text
                  accessibilityRole="header"
                  className="font-sans-semibold text-xl text-primary"
                >
                  Catálogo
                </Text>
              </View>
              <View className="w-11" />
            </View>
            <CatalogSearch
              dismissSignal={searchDismissSignal}
              onSuggestionsInteractionChange={setSuggestionsInteracting}
              value={search}
              onChange={setSearch}
              onClear={() => {
                setFilters((current) => ({ ...current, search: '' }));
              }}
              onSelectProduct={openProduct}
              onSubmit={(term) => {
                Keyboard.dismiss();
                setFilters((current) => ({ ...current, search: term }));
              }}
            />
            <CatalogQuickFilters
              filters={filters}
              onChange={updateFilters}
              onOpenFilters={() => {
                setSearchDismissSignal((signal) => signal + 1);
                Keyboard.dismiss();
                setSheetOpen(true);
              }}
            />
            {isOnline === false ||
            hasFilters ||
            filters.search ||
            (Boolean(query.data) && offers.isError) ||
            query.isRefetchError ? (
              <View className="gap-3 px-5 pb-4">
                {isOnline === false ? (
                  <OfflineState description="Puedes consultar los productos cargados. Actualizaremos el catálogo al recuperar la conexión." />
                ) : null}
                {hasFilters || filters.search ? (
                  <AppButton
                    label="Limpiar filtros"
                    variant="ghost"
                    onPress={clear}
                    className="self-start px-2"
                    labelClassName="text-sm"
                  />
                ) : null}
                {Boolean(query.data) && offers.isError && isOnline !== false ? (
                  <ErrorState
                    title="No pudimos consultar las ofertas"
                    description="Los precios mostrados son los precios base. Reintenta para comprobar las promociones."
                    onRetry={() => void offers.refetch()}
                  />
                ) : null}
                {query.isRefetchError ? (
                  <ErrorState
                    description="No pudimos actualizar el catálogo. Conservamos los productos cargados."
                    onRetry={onRefresh}
                  />
                ) : null}
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          isOnline === false && !query.data ? null : query.isPending || !offers.ready ? (
            <View>
              <ProductGridSkeleton columns={columns} />
            </View>
          ) : query.isError ? (
            <View className="px-5">
              <ErrorState description={getFriendlyErrorMessage(query.error)} onRetry={onRefresh} />
            </View>
          ) : (
            <View className="px-5">
              <EmptyState
                title="No encontramos productos"
                description="Prueba otra búsqueda o cambia los filtros."
                actionLabel="Limpiar filtros"
                onAction={clear}
              />
            </View>
          )
        }
        ListFooterComponent={
          query.data ? (
            <View className="gap-3 px-5 pt-6">
              {query.isFetchNextPageError ? (
                <ErrorState
                  description="No pudimos cargar más productos. Los anteriores siguen disponibles."
                  onRetry={() => void query.fetchNextPage({ cancelRefetch: false })}
                />
              ) : null}
              {query.isFetchingNextPage ? (
                <LoadingState label="Cargando más productos…" />
              ) : !query.hasNextPage && products.length ? (
                <Text className="text-center font-sans text-sm text-secondary">
                  Has visto todos los productos
                </Text>
              ) : null}
            </View>
          ) : null
        }
      />
      {sheetOpen ? (
        <CatalogFiltersSheet
          applied={filters}
          options={query.filters}
          onClose={() => setSheetOpen(false)}
          onChange={updateFilters}
        />
      ) : null}
    </AppScreen>
  );
}
