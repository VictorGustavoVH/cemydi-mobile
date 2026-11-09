import { useCallback, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Search from 'lucide-react-native/icons/search';

import { AppInput } from '@/components/ui/AppInput';
import { AppRefreshControl } from '@/components/ui/AppRefreshControl';
import { AppScreen } from '@/components/ui/AppScreen';
import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { OfflineState } from '@/components/ui/OfflineState';
import { ProductGridItem, ProductGridSeparator } from '@/components/ui/ProductGridItem';
import { useProductGridMetrics } from '@/hooks/useProductGridMetrics';
import { ProductGridSkeleton } from '@/components/ui/ProductGridSkeleton';
import { useAuth } from '@/providers/auth-provider';
import { useProductOffers } from '@/hooks/useProductOffers';
import { useProductRatings } from '@/hooks/useProductRatings';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useRouteCallback } from '@/hooks/useRouteCallback';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { toProductCard } from '@/services/products/product-adapter';
import { prefetchProductDetail } from '@/services/products/product-cache';
import type { HomeProduct } from '@/data/catalog-preview';
import { colors } from '@/theme';
import { getFriendlyErrorMessage } from '@/services/http/api-error';
import { useFavorites } from './hooks/useFavorites';

const productKey = (item: HomeProduct) => item.id;
const FAVORITES_SEARCH_MAX_LENGTH = 100;

export function FavoritesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const grid = useProductGridMetrics();
  const { columns } = grid;

  const { products, isLoading, isError, error, refetch } = useFavorites();
  const offers = useProductOffers();
  const [search, setSearch] = useState('');

  const refresh = useCallback(
    () => Promise.allSettled([refetch(), offers.refetch()]),
    [refetch, offers],
  );
  const refreshEnabled = isOnline !== false;
  const { refreshing, onRefresh } = usePullToRefresh(refresh, { enabled: refreshEnabled });

  const homeProducts = useMemo(() => {
    return products.map((prod) => toProductCard(prod, offers.data?.promotions));
  }, [products, offers.data?.promotions]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es-MX');
    if (!query) return homeProducts;
    return homeProducts.filter((item) =>
      [item.name, item.caption, item.categoryId].some((field) =>
        String(field || '')
          .toLocaleLowerCase('es-MX')
          .includes(query),
      ),
    );
  }, [homeProducts, search]);

  const productIds = useMemo(
    () => filteredProducts.map((product) => product.id),
    [filteredProducts],
  );
  const ratings = useProductRatings(productIds);

  const handleOpenProduct = useRouteCallback(
    (id: string) => {
      prefetchProductDetail(queryClient, id);
      router.push(`/producto/${encodeURIComponent(id)}`);
    },
    (id: string) => `/producto/${id}`,
  );

  const renderItem = useCallback(
    ({ item }: { item: HomeProduct }) => (
      <ProductGridItem
        product={item}
        ratingState={ratings[item.id]}
        onOpen={handleOpenProduct}
        width={grid.itemWidth}
        marginHorizontal={grid.itemMargin}
      />
    ),
    [handleOpenProduct, ratings, grid.itemWidth, grid.itemMargin],
  );

  return (
    <AppScreen edges={['top', 'bottom', 'left', 'right']} scroll={false}>
      <View className="flex-row items-center gap-3 bg-background px-5 py-2">
        <BackButton fallbackHref="/perfil" />
        <View className="flex-1 items-center gap-0.5">
          <Text
            accessibilityRole="header"
            className="text-center font-sans-semibold text-xl text-primary"
          >
            Mis favoritos
          </Text>
          {user && products.length > 0 ? (
            <Text className="text-center font-sans text-xs text-secondary">
              {products.length} producto{products.length === 1 ? '' : 's'} guardado
              {products.length === 1 ? '' : 's'}
            </Text>
          ) : null}
        </View>
        <View className="w-11" />
      </View>

      {!user ? (
        <EmptyState
          title="Inicia sesión para guardar favoritos"
          description="Guarda tus productos y consúltalos desde tu cuenta."
          actionLabel="Iniciar sesión"
          onAction={() => router.push('/login')}
        />
      ) : isOnline === false && products.length === 0 ? (
        <OfflineState description="Conéctate para consultar tus productos guardados." />
      ) : isLoading ? (
        <View className="flex-1 pt-4">
          <ProductGridSkeleton columns={columns} />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center p-6">
          <ErrorState
            title="No se pudieron cargar tus favoritos"
            description={getFriendlyErrorMessage(
              error,
              'Ocurrió un error al consultar tus productos guardados.',
            )}
            onRetry={() => void refetch()}
          />
        </View>
      ) : products.length === 0 ? (
        <EmptyState
          title="No tienes productos guardados"
          description="Toca el corazón de un producto para guardarlo aquí."
          actionLabel="Explorar catálogo"
          onAction={() => router.navigate('/catalogo')}
        />
      ) : (
        <View className="flex-1 bg-background">
          {isOnline === false ? (
            <View className="shrink-0">
              <OfflineState description="Mostramos los favoritos cargados. Actualizaremos la lista al recuperar la conexión." />
            </View>
          ) : null}
          {products.length > 4 ? (
            <View className="bg-background px-5 py-2">
              <AppInput
                label="Buscar en mis favoritos"
                placeholder="Buscar por nombre o marca..."
                value={search}
                maxLength={FAVORITES_SEARCH_MAX_LENGTH}
                onChangeText={(text) => setSearch(text.slice(0, FAVORITES_SEARCH_MAX_LENGTH))}
                leadingIcon={<Search aria-hidden size={18} color={colors.textSecondary} />}
              />
            </View>
          ) : null}

          {filteredProducts.length === 0 ? (
            <EmptyState
              title="Sin resultados"
              description={`No encontramos productos guardados que coincidan con "${search}".`}
              actionLabel="Limpiar búsqueda"
              onAction={() => setSearch('')}
            />
          ) : (
            <FlatList
              onLayout={grid.onLayout}
              key={columns}
              data={filteredProducts}
              keyExtractor={productKey}
              renderItem={renderItem}
              numColumns={columns}
              columnWrapperStyle={grid.columnWrapperStyle}
              contentContainerStyle={{
                paddingTop: 16,
                paddingBottom: 32,
              }}
              ItemSeparatorComponent={ProductGridSeparator}
              refreshControl={
                <AppRefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  enabled={refreshEnabled}
                />
              }
            />
          )}
        </View>
      )}
    </AppScreen>
  );
}
