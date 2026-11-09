import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { AppButton } from '@/components/ui/AppButton';
import { AppPagination } from '@/components/ui/AppPagination';
import { AppRefreshControl } from '@/components/ui/AppRefreshControl';
import { AppScreen } from '@/components/ui/AppScreen';
import { BackButton } from '@/components/ui/BackButton';
import { CatalogSearch } from '@/components/ui/CatalogSearch';
import { EmptyState } from '@/components/ui/EmptyState';
import { EmptyProductIcon } from '@/components/ui/EmptyProductIcon';
import { ErrorState } from '@/components/ui/ErrorState';
import { OfflineState } from '@/components/ui/OfflineState';
import { ProductGridItem, ProductGridSeparator } from '@/components/ui/ProductGridItem';
import { useProductGridMetrics } from '@/hooks/useProductGridMetrics';
import { ProductGridSkeleton } from '@/components/ui/ProductGridSkeleton';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useProductOffers } from '@/hooks/useProductOffers';
import { useProductRatings } from '@/hooks/useProductRatings';
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
  const grid = useProductGridMetrics();
  const { columns } = grid;
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
  const [page, setPage] = useState(1);
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
      setPage(1);
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
      list.current?.scrollToOffset({ offset: 0, animated: false });
    }, [incoming, params.search, params.clasificacion, params.mode, params.filters]),
  );
  const query = useCatalog(filters, page);
  const offers = useProductOffers();
  const loadedPage = query.data?.pagination.page;
  const totalPages = query.data?.pagination.totalPages;
  // Al cambiar de página se conserva la anterior mientras llega la nueva, así
  // que el salto al inicio se hace cuando el servidor confirma la página.
  const lastLoadedPage = useRef(loadedPage);
  useLayoutEffect(() => {
    if (loadedPage === undefined) return;
    const previous = lastLoadedPage.current;
    lastLoadedPage.current = loadedPage;
    if (previous !== undefined && previous !== loadedPage) {
      list.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [loadedPage]);
  const changePage = useCallback(
    (next: number) => {
      setPage(totalPages ? Math.min(Math.max(1, next), totalPages) : next);
      list.current?.scrollToOffset({ offset: 0, animated: false });
    },
    [totalPages],
  );

  const refresh = useCallback(
    () =>
      Promise.allSettled([
        query.refetch(),
        offers.refetch(),
        queryClient.invalidateQueries({ queryKey: ['reviews', 'product'] }),
      ]),
    [query, offers, queryClient],
  );
  const refreshEnabled = isOnline !== false;
  const { refreshing, onRefresh } = usePullToRefresh(refresh, { enabled: refreshEnabled });
  useEffect(() => {
    const timeout = setTimeout(
      () => {
        setPage(1);
        setFilters((current) => {
          if (current.search === search.trim()) return current;
          return { ...current, search: search.trim() };
        });
      },
      search.trim() === '' ? 0 : 350,
    );
    return () => clearTimeout(timeout);
  }, [search]);
  const isFirstMount = useRef(true);
  const prevFiltersRef = useRef(filters);
  const prevColumnsRef = useRef(columns);
  useLayoutEffect(() => {
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
      <ProductGridItem
        product={item}
        ratingState={ratings[item.id]}
        onOpen={openProduct}
        width={grid.itemWidth}
        marginHorizontal={grid.itemMargin}
      />
    ),
    [openProduct, ratings, grid.itemWidth, grid.itemMargin],
  );

  const clear = () => {
    setPage(1);
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
    setPage(1);
    setFilters({ ...next, search: search.trim() });
    list.current?.scrollToOffset({ offset: 0, animated: false });
  };
  return (
    <AppScreen edges={['top', 'left', 'right']}>
      <FlatList
        onLayout={grid.onLayout}
        ref={list}
        scrollEnabled={!suggestionsInteracting}
        onScrollBeginDrag={() => setSearchDismissSignal((signal) => signal + 1)}
        accessibilityLabel="Productos del catálogo"
        accessibilityElementsHidden={sheetOpen}
        importantForAccessibility={sheetOpen ? 'no-hide-descendants' : 'auto'}
        key={columns}
        numColumns={columns}
        data={query.isPlaceholderData ? [] : products}
        keyExtractor={productKey}
        renderItem={renderProduct}
        columnWrapperStyle={grid.columnWrapperStyle}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        ItemSeparatorComponent={ProductGridSeparator}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScroll={onToastScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <AppRefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            enabled={refreshEnabled}
          />
        }
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
                setPage(1);
                setFilters((current) => ({ ...current, search: '' }));
              }}
              onSelectProduct={openProduct}
              onSubmit={(term) => {
                Keyboard.dismiss();
                setPage(1);
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
          isOnline === false && !query.data ? null : query.isPending ||
            !offers.ready ||
            query.isPlaceholderData ? (
            <View>
              <ProductGridSkeleton columns={columns} />
            </View>
          ) : query.isError ? (
            <View className="px-5">
              <ErrorState description={getFriendlyErrorMessage(query.error)} onRetry={onRefresh} />
            </View>
          ) : query.data && query.data.pagination.total > 0 ? (
            <View className="px-5">
              <EmptyState
                title="Esta página ya no está disponible"
                description="El catálogo cambió mientras navegabas. Vuelve a la primera página para seguir explorando."
                actionLabel="Volver a la primera página"
                onAction={() => changePage(1)}
              />
            </View>
          ) : (
            <View className="px-5">
              <EmptyState
                icon={<EmptyProductIcon />}
                title="No encontramos productos"
                description="Prueba otra búsqueda o cambia los filtros."
                actionLabel="Limpiar filtros"
                onAction={clear}
              />
            </View>
          )
        }
        ListFooterComponent={
          query.data && query.data.pagination.totalPages > 1 ? (
            <View className="px-5 pt-4">
              <AppPagination
                page={Math.min(query.data.pagination.page, query.data.pagination.totalPages)}
                totalPages={query.data.pagination.totalPages}
                disabled={query.isFetching || isOnline === false}
                loading={false}
                onPageChange={changePage}
              />
            </View>
          ) : null
        }
      />
      {sheetOpen ? (
        <CatalogFiltersSheet
          applied={filters}
          options={query.isPlaceholderData ? undefined : query.filters}
          onClose={() => setSheetOpen(false)}
          onChange={updateFilters}
        />
      ) : null}
    </AppScreen>
  );
}
