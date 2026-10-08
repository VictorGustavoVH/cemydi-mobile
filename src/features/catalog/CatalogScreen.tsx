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
import { ProductCard } from '@/components/ui/ProductCard';
import { ProductGridSkeleton } from '@/components/ui/ProductGridSkeleton';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useProductOffers } from '@/hooks/useProductOffers';
import { useToastScroll } from '@/hooks/useToast';
import { toProductCard } from '@/services/products/product-adapter';
import { emptyProductFilters, type ProductFilters } from '@/services/products/product-service';
import type { HomeProduct } from '@/data/catalog-preview';
import { colors } from '@/theme';
import { useCatalog } from './hooks/useCatalog';
import { CatalogFiltersSheet } from './components/CatalogFiltersSheet';

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
  const query = useCatalog(filters);
  const offers = useProductOffers();
  useEffect(() => {
    const timeout = setTimeout(
      () =>
        setFilters((current) =>
          current.search === search.trim() ? current : { ...current, search: search.trim() },
        ),
      350,
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
  const openProduct = useCallback(
    (id: string) =>
      router.push({
        pathname: '/producto/[id]',
        params: { id, mode: mode === 'all' ? undefined : mode },
      }),
    [router, mode],
  );
  const renderProduct = useCallback(
    ({ item }: { item: HomeProduct }) => (
      <CatalogItem
        product={item}
        onOpen={openProduct}
        width={(width - 40 - (columns - 1) * 12) / columns}
      />
    ),
    [openProduct, width, columns],
  );
  const clear = () => {
    setSearch('');
    setFilters(emptyProductFilters);
  };
  const activeCount =
    filters.clasificaciones.length +
    filters.marcas.length +
    filters.tipos.length +
    Number(filters.requiereReceta !== null) +
    Number(filters.soloDisponibles);
  return (
    <AppScreen edges={['top', 'left', 'right']}>
      <View className="flex-row items-center gap-2 px-4 py-2">
        <BackButton fallbackHref="/inicio" />
        <Text accessibilityRole="header" className="flex-1 font-sans-bold text-2xl text-primary">
          Catálogo
        </Text>
      </View>
      <CatalogSearch
        value={search}
        onChange={setSearch}
        onFilters={() => {
          Keyboard.dismiss();
          setSheetOpen(true);
        }}
        onSubmit={() => {
          Keyboard.dismiss();
          setFilters((current) => ({ ...current, search: search.trim() }));
        }}
      />
      <FlatList
        ref={list}
        key={columns}
        numColumns={columns}
        data={products}
        keyExtractor={productKey}
        renderItem={renderProduct}
        columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        ItemSeparatorComponent={ProductSeparator}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScroll={onToastScroll}
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
          <View className="gap-3 pb-4">
            {isOnline === false ? (
              <OfflineState description="Puedes consultar los productos cargados. Actualizaremos el catálogo al recuperar la conexión." />
            ) : null}
            <View className="flex-row items-center justify-between gap-2">
              <Text
                accessibilityLiveRegion="polite"
                className="flex-1 font-sans text-sm text-secondary"
              >
                {query.data
                  ? `${products.length} de ${query.pagination?.total ?? 0} productos`
                  : 'Productos de compra y renta'}
              </Text>
              {activeCount > 0 || filters.search || filters.sort !== 'reciente' ? (
                <AppButton
                  label={`Limpiar filtros${activeCount ? ` (${activeCount})` : ''}`}
                  variant="ghost"
                  onPress={clear}
                  className="px-2"
                  labelClassName="text-sm"
                />
              ) : null}
            </View>
            {offers.isError && isOnline !== false ? (
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
        }
        ListEmptyComponent={
          isOnline === false && !query.data ? null : query.isPending ? (
            <View style={{ marginHorizontal: -20 }}>
              <ProductGridSkeleton columns={columns} />
            </View>
          ) : query.isError ? (
            <ErrorState description={query.error.message} onRetry={() => void query.refetch()} />
          ) : (
            <EmptyState
              title="No encontramos productos"
              description="Prueba otra búsqueda o cambia los filtros."
              actionLabel="Limpiar filtros"
              onAction={clear}
            />
          )
        }
        ListFooterComponent={
          query.data ? (
            <View className="gap-3 pt-6">
              {query.isFetchNextPageError ? (
                <ErrorState
                  description="No pudimos cargar más productos. Los anteriores siguen disponibles."
                  onRetry={() => void query.fetchNextPage({ cancelRefetch: false })}
                />
              ) : null}
              {query.hasNextPage ? (
                <AppButton
                  label="Ver más"
                  accessibilityLabel="Ver más productos"
                  loading={query.isFetchingNextPage}
                  disabled={isOnline === false || query.isFetching}
                  variant="outline"
                  onPress={() => {
                    if (!query.isFetching) void query.fetchNextPage({ cancelRefetch: false });
                  }}
                />
              ) : products.length ? (
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
          onApply={(next) => {
            setFilters({ ...next, search: search.trim() });
            setSheetOpen(false);
          }}
        />
      ) : null}
    </AppScreen>
  );
}
