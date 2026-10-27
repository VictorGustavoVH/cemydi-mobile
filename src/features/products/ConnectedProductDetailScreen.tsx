import { useMemo } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';

import { AppScreen } from '@/components/ui/AppScreen';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { OfflineState } from '@/components/ui/OfflineState';
import { Skeleton, SkeletonBlock } from '@/components/ui/Skeleton';

import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useProductOffers } from '@/hooks/useProductOffers';
import { useProductReviews } from '@/hooks/useProductReviews';

import { getFriendlyErrorMessage, isApiError } from '@/services/http/api-error';
import { productDetailKey } from '@/services/products/product-cache';
import { toProductCard, toProductDetail } from '@/services/products/product-adapter';
import type { Product, ProductList } from '@/services/products/product-schemas';
import { productRepository } from '@/services/products/product-repository';

import { ProductDetailScreen } from './ProductDetailScreen';
import { ProductDetailHeader } from './components/ProductDetailHeader';
import { recommendationCardWidth } from './components/recommendation-card-metrics';
import {
  PRODUCT_DETAIL_THUMBNAIL_SIZE,
  productDetailGalleryHeight,
} from './components/product-detail-layout';

type ConnectedProductDetailScreenProps = {
  productId: string;
  initialMode?: 'purchase' | 'rental';
};

// --------------------------------------------------
// SKELETON DE DETALLES DEL PRODUCTO
// --------------------------------------------------

function ProductDetailSkeleton() {
  const { width, fontScale } = useWindowDimensions();

  const compact = width < 350 || fontScale > 1.3;
  const galleryHeight = productDetailGalleryHeight(width);

  return (
    <Skeleton label="Cargando producto…">
      {/* IMAGEN PRINCIPAL */}
      <View className="w-full bg-white" style={{ height: galleryHeight }}>
        <View className="h-full w-full p-6">
          <SkeletonBlock className="h-full w-full rounded-xl" />
        </View>
      </View>

      {/* CONTENIDO */}
      <View className="gap-5 px-5 pt-4">
        {/* MINIATURAS */}
        <View className="flex-row gap-2.5">
          {Array.from({ length: 3 }, (_, index) => (
            <View
              key={index}
              style={{
                width: PRODUCT_DETAIL_THUMBNAIL_SIZE,
                height: PRODUCT_DETAIL_THUMBNAIL_SIZE,
              }}
              className="rounded-xl border border-border/50 bg-white p-1.5"
            >
              <SkeletonBlock className="h-full w-full rounded-lg" />
            </View>
          ))}
        </View>

        {/* CATEGORÍA, CALIFICACIÓN Y NOMBRE */}
        <View className="gap-2">
          {/* CATEGORÍA Y ESTRELLA EN LA MISMA FILA */}
          <View className="min-h-11 flex-row items-center justify-between gap-2">
            {/* CATEGORÍA */}
            <View className="min-w-0 flex-1">
              <SkeletonBlock className="h-4 w-3/4 rounded" />
            </View>

            {/* ESTRELLA Y PUNTAJE */}
            <View className="shrink-0 flex-row items-center gap-1">
              <SkeletonBlock className="h-4 w-4 rounded" />
              <SkeletonBlock className="h-4 w-7 rounded" />
              <SkeletonBlock className="h-3 w-6 rounded" />
            </View>
          </View>

          {/* NOMBRE DEL PRODUCTO */}
          <View className="gap-2">
            <SkeletonBlock className="h-7 w-full rounded" />
            <SkeletonBlock className="h-7 w-4/5 rounded" />
          </View>
        </View>

        {/* MODALIDAD DE ADQUISICIÓN */}
        <View className="flex-row gap-2 rounded-2xl bg-surface-muted p-1">
          <View className="flex-1">
            <SkeletonBlock className="h-11 w-full rounded-xl" />
          </View>
          <View className="flex-1">
            <SkeletonBlock className="h-11 w-full rounded-xl" />
          </View>
        </View>

        {/* PRECIO */}
        <View className="gap-2">
          <SkeletonBlock className="h-4 w-1/3 rounded" />
          <SkeletonBlock className="h-8 w-1/2 rounded" />
          <SkeletonBlock className="h-4 w-1/4 rounded" />
        </View>

        {/* DESCRIPCIÓN Y CARACTERÍSTICAS */}
        <View className="gap-4">
          {/* PESTAÑAS */}
          <View className="flex-row gap-2 border-b border-border/50 pb-3">
            <View className="flex-1">
              <SkeletonBlock className="h-11 w-full rounded-full" />
            </View>
            <View className="flex-1">
              <SkeletonBlock className="h-11 w-full rounded-full" />
            </View>
          </View>

          {/* TEXTO DE DESCRIPCIÓN */}
          <View className="gap-3">
            <SkeletonBlock className="h-4 w-full rounded" />
            <SkeletonBlock className="h-4 w-full rounded" />
            <SkeletonBlock className="h-4 w-4/5 rounded" />
            <SkeletonBlock className="h-4 w-2/3 rounded" />
          </View>
        </View>

        {/* SECCIÓN DE RESEÑAS */}
        <View className="gap-4 border-t border-border/40 pt-5">
          <SkeletonBlock className="h-6 w-28 rounded" />

          <View className="flex-row items-center gap-2">
            <SkeletonBlock className="h-8 w-14 rounded" />
            <SkeletonBlock className="h-4 w-32 rounded" />
          </View>

          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <SkeletonBlock className="h-4 w-28 rounded" />
              <SkeletonBlock className="h-4 w-24 rounded" />
            </View>

            <SkeletonBlock className="h-4 w-full rounded" />
            <SkeletonBlock className="h-4 w-4/5 rounded" />
          </View>
        </View>

        {/* PRODUCTOS RECOMENDADOS */}
        <View className="gap-4">
          <SkeletonBlock className="h-6 w-48 rounded" />

          <View className="flex-row gap-3" style={{ alignItems: 'flex-start' }}>
            {Array.from({ length: 2 }, (_, index) => (
              <View
                key={index}
                style={{ width: recommendationCardWidth(compact) }}
                className="overflow-hidden rounded-xl border border-border/50 bg-white"
              >
                <SkeletonBlock className="aspect-square w-full rounded-none" />

                <View className="p-3">
                  <View className="mb-1 flex-row items-center justify-between gap-2">
                    <SkeletonBlock className="h-3 w-2/3 rounded" />
                    <SkeletonBlock className="h-3 w-7 rounded" />
                  </View>
                  <View className="gap-2" style={{ minHeight: 40 }}>
                    <SkeletonBlock className="h-4 w-full rounded" />
                    <SkeletonBlock className="h-4 w-4/5 rounded" />
                  </View>
                  <View className="mt-auto gap-2 pt-3">
                    <SkeletonBlock className="h-3 w-2/3 rounded" />
                    <SkeletonBlock className="h-6 w-3/4 rounded" />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Skeleton>
  );
}

// --------------------------------------------------
// PANTALLA CONECTADA A LA API
// --------------------------------------------------

export function ConnectedProductDetailScreen({
  productId,
  initialMode,
}: ConnectedProductDetailScreenProps) {
  const { isOnline } = useNetworkStatus();

  const queryClient = useQueryClient();
  const cachedProduct = useMemo(() => {
    let newest: { product: Product; updatedAt: number } | undefined;
    const lists = queryClient.getQueriesData<InfiniteData<ProductList>>({
      queryKey: ['products', 'list'],
    });
    const recommendations = queryClient.getQueriesData<{ recommendations: Product[] }>({
      queryKey: ['products', 'recommendations'],
    });
    for (const [key, data] of lists) {
      const product = data?.pages
        .flatMap((page) => page.products)
        .find((item) => String(item.id) === productId);
      const updatedAt = queryClient.getQueryState(key)?.dataUpdatedAt ?? 0;
      if (product && (!newest || updatedAt > newest.updatedAt)) newest = { product, updatedAt };
    }
    for (const [key, data] of recommendations) {
      const product = data?.recommendations.find((item) => String(item.id) === productId);
      const updatedAt = queryClient.getQueryState(key)?.dataUpdatedAt ?? 0;
      if (product && (!newest || updatedAt > newest.updatedAt)) newest = { product, updatedAt };
    }
    return newest;
  }, [productId, queryClient]);

  // DETALLES DEL PRODUCTO
  const query = useQuery({
    queryKey: productDetailKey(productId),
    queryFn: ({ signal }) => productRepository.detail(productId, signal),
    enabled: Boolean(productId),
    staleTime: 30_000,
    initialData: () => cachedProduct && { product: cachedProduct.product },
    initialDataUpdatedAt: cachedProduct?.updatedAt,
  });

  // PROMOCIONES
  const offers = useProductOffers();

  // RESEÑAS
  const reviews = useProductReviews(productId);

  // RECOMENDACIONES
  const recommendations = useQuery({
    queryKey: ['products', 'recommendations', productId],
    queryFn: ({ signal }) => productRepository.recommendations(productId, signal),
    enabled: Boolean(productId),
    staleTime: 30_000,
  });

  // ADAPTAR PRODUCTOS RECOMENDADOS
  const recommendedProducts = useMemo(
    () =>
      recommendations.data?.recommendations.map((item) =>
        toProductCard(item, offers.data?.promotions),
      ) ?? [],
    [recommendations.data, offers.data],
  );

  // ADAPTAR DETALLES DEL PRODUCTO
  // Las ofertas añaden precio tachado y porcentaje al bloque de precio: no se
  // pinta la ficha hasta conocerlas para no desplazar el contenido después.
  const product = useMemo(
    () =>
      query.data && offers.ready
        ? toProductDetail(query.data.product, offers.data?.promotions)
        : undefined,
    [query.data, offers.data, offers.ready],
  );

  // --------------------------------------------------
  // PRODUCTO CARGADO
  // --------------------------------------------------

  if (product) {
    return (
      <ProductDetailScreen
        productId={productId}
        initialMode={initialMode}
        suppliedProduct={product}
        suppliedReviews={reviews.data}
        suppliedRecommendations={recommendedProducts}

        // ESTADO DE LAS RESEÑAS
        reviewsStatus={
          !reviews.data ? (
            isOnline === false ? (
              <OfflineState description="Conéctate para consultar las reseñas." />
            ) : reviews.isPending ? (
              <Skeleton label="Cargando reseñas…">
                <View className="gap-3">
                  <View className="flex-row items-center gap-2">
                    <SkeletonBlock className="h-8 w-14 rounded" />
                    <SkeletonBlock className="h-4 w-32 rounded" />
                  </View>

                  <View className="gap-2">
                    <SkeletonBlock className="h-4 w-full rounded" />
                    <SkeletonBlock className="h-4 w-4/5 rounded" />
                  </View>
                </View>
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

        // ESTADO DE LAS RECOMENDACIONES
        recommendationsStatus={
          !recommendations.data ? (
            isOnline === false ? (
              <OfflineState description="Conéctate para consultar los productos recomendados." />
            ) : recommendations.isPending ? (
              <Skeleton label="Cargando recomendaciones…">
                <View className="flex-row gap-3">
                  {Array.from({ length: 2 }, (_, index) => (
                    <View
                      key={index}
                      className="w-36 overflow-hidden rounded-xl border border-border/50"
                    >
                      <SkeletonBlock className="aspect-square w-full rounded-none" />

                      <View className="gap-2 p-3">
                        <SkeletonBlock className="h-3 w-2/3 rounded" />
                        <SkeletonBlock className="h-4 w-full rounded" />
                        <SkeletonBlock className="h-4 w-4/5 rounded" />
                        <SkeletonBlock className="h-6 w-3/4 rounded" />
                      </View>
                    </View>
                  ))}
                </View>
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

        // ESTADO REMOTO DEL PRODUCTO
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
  }

  // --------------------------------------------------
  // CARGA INICIAL, OFFLINE Y ERRORES
  // --------------------------------------------------

  return (
    <AppScreen edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        contentInsetAdjustmentBehavior="never"
      >
        {/* ENCABEZADO: VOLVER, FAVORITO Y COMPARTIR */}
        <ProductDetailHeader productId={productId} fallbackHref="/catalogo" />

        {isOnline === false ? (
          <OfflineState />
        ) : query.isPending || !offers.ready ? (
          <ProductDetailSkeleton />
        ) : isApiError(query.error) && query.error.status === 404 ? (
          <EmptyState
            title="Producto no disponible"
            description="Este producto ya no está publicado. Regresa al catálogo para consultar otros equipos."
          />
        ) : (
          <ErrorState
            description={getFriendlyErrorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        )}

        <Text className="px-5 py-4 font-sans text-sm text-secondary">
          Compra y renta de equipo ortopédico
        </Text>
      </ScrollView>
    </AppScreen>
  );
}
