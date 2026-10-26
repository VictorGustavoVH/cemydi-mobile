import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Search from 'lucide-react-native/icons/search';

import { AppInput } from '@/components/ui/AppInput';
import { AppRefreshControl } from '@/components/ui/AppRefreshControl';
import { AppScreen } from '@/components/ui/AppScreen';
import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProductCard } from '@/components/ui/ProductCard';
import { ProductGridSkeleton } from '@/components/ui/ProductGridSkeleton';
import { useAuth } from '@/providers/auth-provider';
import { useProductOffers } from '@/hooks/useProductOffers';
import { useProductRatings, type ProductRatingState } from '@/hooks/useProductRatings';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useRouteCallback } from '@/hooks/useRouteCallback';
import { toProductCard } from '@/services/products/product-adapter';
import { prefetchProductDetail } from '@/services/products/product-cache';
import type { HomeProduct } from '@/data/catalog-preview';
import { colors } from '@/theme';
import { getFriendlyErrorMessage } from '@/services/http/api-error';
import { useFavorites } from './hooks/useFavorites';

const productKey = (item: HomeProduct) => item.id;

function ProductSeparator() {
  return <View className="h-4" />;
}

const FavoriteGridItem = memo(function FavoriteGridItem({
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

export function FavoritesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { width, fontScale } = useWindowDimensions();
  const columns = width < 350 || fontScale > 1.3 ? 1 : 2;
  const itemWidth = columns === 1 ? width - 32 : (width - 44) / 2;

  const { products, isLoading, isError, error, refetch, isFetching } = useFavorites();
  const offers = useProductOffers();
  const [search, setSearch] = useState('');

  const refresh = useCallback(
    () => Promise.allSettled([refetch(), offers.refetch()]),
    [refetch, offers],
  );
  const { refreshing, onRefresh } = usePullToRefresh(refresh);

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
      <FavoriteGridItem
        product={item}
        ratingState={ratings[item.id]}
        onOpen={handleOpenProduct}
        width={itemWidth}
      />
    ),
    [handleOpenProduct, itemWidth, ratings],
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
          description="Tus productos guardados se sincronizarán con tu cuenta CEMYDI en todos tus dispositivos."
          actionLabel="Iniciar sesión"
          onAction={() => router.push('/login')}
        />
      ) : isLoading ? (
        <View className="flex-1 p-4">
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
          description="Usa el botón de corazón en el detalle del producto para crear tu lista de artículos y revisarlos más adelante."
          actionLabel="Explorar catálogo"
          onAction={() => router.navigate('/catalogo')}
        />
      ) : (
        <View className="flex-1 bg-background">
          {products.length > 4 ? (
            <View className="bg-background px-4 py-2">
              <AppInput
                label="Buscar en mis favoritos"
                placeholder="Buscar por nombre o marca..."
                value={search}
                onChangeText={setSearch}
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
              key={columns}
              data={filteredProducts}
              keyExtractor={productKey}
              renderItem={renderItem}
              numColumns={columns}
              columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 32,
              }}
              ItemSeparatorComponent={ProductSeparator}
              refreshControl={
                <AppRefreshControl refreshing={refreshing || isFetching} onRefresh={onRefresh} />
              }
            />
          )}
        </View>
      )}
    </AppScreen>
  );
}
