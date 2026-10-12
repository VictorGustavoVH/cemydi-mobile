import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, RefreshControl, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton } from '@/components/ui/AppButton';
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
import { useProductOffers } from '@/hooks/useProductOffers';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';
import { useToastScroll } from '@/hooks/useToast';
import { toProductCard } from '@/services/products/product-adapter';
import { emptyProductFilters, type ProductFilters } from '@/services/products/product-service';
import type { HomeProduct } from '@/data/catalog-preview';
import { getFriendlyErrorMessage } from '@/services/http/api-error';
import { colors } from '@/theme';
import { useCatalog } from './hooks/useCatalog';
import { CatalogFiltersSheet } from './components/CatalogFiltersSheet';
import { CatalogQuickFilters } from './components/CatalogQuickFilters';

const productKey = (item: HomeProduct) => item.id;
function ProductSeparator() {
  return <View className="h-4" />;
}
const CatalogItem = memo(function CatalogItem({
  product,
  onOpen,
  width,
}: {
  product: HomeProduct;
  onOpen: (id: string) => void;
  width: number;
}) {
  return (
    <View style={{ width }}>
      <ProductCard product={product} onPress={() => onOpen(product.id)} />
    </View>
  );
});

export function CatalogScreen() {
  const params = useLocalSearchParams<{
    search?: string;
    clasificacion?: string;
    mode?: string;
    filters?: string;
  }>();
  const router = useRouter();
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
  const query = useCatalog(filters);
  const offers = useProductOffers();
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
  useEffect(() => {
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [filters, columns]);
  const mode =
    filters.tipos.includes('RENTA') && !filters.tipos.includes('VENTA') ? 'rental' : 'all';
  const products = useMemo(
    () => query.products.map((product) => toProductCard(product, offers.data?.promotions, mode)),
    [query.products, offers.data, mode],
  );
  const openProduct = useThrottledCallback(
    (id: string) =>
      router.push({
        pathname: '/producto/[id]',
        params: { id, mode: mode === 'all' ? undefined : mode },
      }),
    750,
  );
  const renderProduct = useCallback(
    ({ item }: { item: HomeProduct }) => (
      <View style={{ marginHorizontal: columns === 1 ? 20 : 0 }}>
        <CatalogItem
          product={item}
          onOpen={openProduct}
          width={(width - 40 - (columns - 1) * 12) / columns}
        />
      </View>
    ),
    [openProduct, width, columns],
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
        contentContainerStyle={{ paddingBottom: 24 }}
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
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => {
              void query.refetch();
              void offers.refetch();
            }}
            tintColor={colors.brandStrong}
            colors={[colors.brandStrong]}
          />
        }
        ListHeaderComponent={
          <>
            <View className="flex-row items-center gap-2 px-4 py-2">
              <BackButton fallbackHref="/inicio" />
              <Text
                accessibilityRole="header"
                className="flex-1 font-sans-bold text-2xl text-primary"
              >
                Catálogo
              </Text>
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
                    onRetry={() => void query.refetch()}
                  />
                ) : null}
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          isOnline === false && !query.data ? null : query.isPending ? (
            <View>
              <ProductGridSkeleton columns={columns} />
            </View>
          ) : query.isError ? (
            <View className="px-5">
              <ErrorState
                description={getFriendlyErrorMessage(query.error)}
                onRetry={() => {
                  void query.refetch();
                  void offers.refetch();
                }}
              />
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
