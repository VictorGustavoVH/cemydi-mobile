import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { AppScreen } from '@/components/ui/AppScreen';
import { BackButton } from '@/components/ui/BackButton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { OfflineState } from '@/components/ui/OfflineState';
import { Skeleton, SkeletonBlock } from '@/components/ui/Skeleton';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useProductOffers } from '@/hooks/useProductOffers';
import { isApiError } from '@/services/http/api-error';
import { toProductCard, toProductDetail } from '@/services/products/product-adapter';
import { productService } from '@/services/products/product-service';
import { ProductDetailScreen } from './ProductDetailScreen';

type ConnectedProductDetailScreenProps = { productId: string; initialMode?: 'purchase' | 'rental' };

export function ConnectedProductDetailScreen({
  productId,
  initialMode,
}: ConnectedProductDetailScreenProps) {
  const { isOnline } = useNetworkStatus();
  const query = useQuery({
    queryKey: ['products', 'detail', productId],
    queryFn: ({ signal }) => productService.detail(productId, signal),
    staleTime: 30_000,
  });
  const offers = useProductOffers();
  const reviews = useQuery({
    queryKey: ['reviews', 'product', productId],
    queryFn: ({ signal }) => productService.reviews(productId, signal),
    enabled: !!query.data,
    staleTime: 30_000,
  });
  const recommendations = useQuery({
    queryKey: ['products', 'recommendations', productId],
    queryFn: ({ signal }) => productService.recommendations(productId, signal),
    enabled: !!query.data,
    staleTime: 30_000,
  });
  const recommendedProducts = useMemo(
    () =>
      recommendations.data?.recommendations.map((item) =>
        toProductCard(item, offers.data?.promotions),
      ) ?? [],
    [recommendations.data, offers.data],
  );
  const product = useMemo(
    () => (query.data ? toProductDetail(query.data.product, offers.data?.promotions) : undefined),
    [query.data, offers.data],
  );
  if (product)
    return (
      <ProductDetailScreen
        productId={productId}
        initialMode={initialMode}
        suppliedProduct={product}
        suppliedReviews={reviews.data}
        suppliedRecommendations={recommendedProducts}
        reviewsStatus={
          !reviews.data ? (
            isOnline === false ? (
              <OfflineState description="Conéctate para consultar las reseñas." />
            ) : reviews.isPending ? (
              <Skeleton label="Cargando reseñas…">
                <SkeletonBlock className="h-20 w-full" />
              </Skeleton>
            ) : (
              <ErrorState
                description="No pudimos consultar las reseñas."
                onRetry={() => void reviews.refetch()}
              />
            )
          ) : reviews.isRefetchError ? (
            <ErrorState
              description="No pudimos actualizar las reseñas."
              onRetry={() => void reviews.refetch()}
            />
          ) : null
        }
        recommendationsStatus={
          !recommendations.data ? (
            isOnline === false ? (
              <OfflineState description="Conéctate para consultar los productos recomendados." />
            ) : recommendations.isPending ? (
              <Skeleton label="Cargando recomendaciones…">
                <SkeletonBlock className="h-40 w-full" />
              </Skeleton>
            ) : (
              <ErrorState
                description="No pudimos consultar las recomendaciones."
                onRetry={() => void recommendations.refetch()}
              />
            )
          ) : recommendations.isRefetchError ? (
            <ErrorState
              description="No pudimos actualizar las recomendaciones."
              onRetry={() => void recommendations.refetch()}
            />
          ) : null
        }
        remoteStatus={
          <>
            {isOnline === false ? (
              <OfflineState description="Mostramos la última información cargada. La disponibilidad puede cambiar." />
            ) : null}
            {query.isRefetchError ? (
              <ErrorState
                description="No pudimos actualizar este producto."
                onRetry={() => void query.refetch()}
              />
            ) : null}
            {offers.isError && isOnline !== false ? (
              <ErrorState
                title="No pudimos consultar las ofertas"
                description="Se muestra el precio base del producto."
                onRetry={() => void offers.refetch()}
              />
            ) : null}
          </>
        }
      />
    );
  return (
    <AppScreen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View className="px-4 py-2">
        <BackButton fallbackHref="/catalogo" />
      </View>
      {isOnline === false ? (
        <OfflineState />
      ) : query.isPending ? (
        <Skeleton label="Cargando producto…">
          <View className="gap-4 px-5">
            <SkeletonBlock className="aspect-square w-full" />
            <SkeletonBlock className="h-8 w-3/4" />
            <SkeletonBlock className="h-6 w-1/2" />
            <SkeletonBlock className="h-32 w-full" />
          </View>
        </Skeleton>
      ) : isApiError(query.error) && query.error.status === 404 ? (
        <EmptyState
          title="Producto no disponible"
          description="Este producto ya no está publicado. Regresa al catálogo para consultar otros equipos."
        />
      ) : (
        <ErrorState
          description={query.error?.message ?? 'No pudimos cargar este producto.'}
          onRetry={() => void query.refetch()}
        />
      )}
      <Text className="px-5 py-4 font-sans text-sm text-secondary">
        Compra y renta de equipo ortopédico
      </Text>
    </AppScreen>
  );
}
