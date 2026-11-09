import { FlatList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ReviewEntryButton } from '@/features/reviews';
import { RatingStars } from '@/components/ui/RatingStars';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { colors } from '@/theme';
import { AppButton } from '@/components/ui/AppButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { AppRefreshControl } from '@/components/ui/AppRefreshControl';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AccountResourceState } from '@/components/account/AccountResourceState';
import { AccountStatusBadge } from '@/components/account/AccountStatusBadge';
import { accountDate } from './account-format';
import { accountService } from './account-service';
import { useAccountResource } from './useAccountResource';

function ReviewSeparator() {
  return <View className="my-4 h-px bg-border" />;
}

export function MyReviewsScreen() {
  const router = useRouter();
  const { query, isOnline } = useAccountResource(['reviews'], accountService.reviews, {
    autoRefresh: true,
  });
  const { refreshing, onRefresh } = usePullToRefresh(query.refetch, {
    enabled: isOnline !== false,
  });
  return (
    <AccountLayout title="Mis reseñas" scroll={false}>
      <AccountResourceState {...query} isOnline={isOnline} retry={() => void query.refetch()}>
        <FlatList
          data={query.data?.reviews ?? []}
          ListHeaderComponent={
            query.data?.reviews.length ? (
              <AppButton
                label="Escribir otra reseña"
                accessibilityHint="Elige un producto del catálogo para compartir tu experiencia."
                variant="ghost"
                className="mb-3 self-start px-0"
                onPress={() => router.navigate('/catalogo')}
              />
            ) : null
          }
          keyExtractor={(item) => String(item.id)}
          ItemSeparatorComponent={ReviewSeparator}
          contentContainerStyle={{ padding: 20, flexGrow: 1 }}
          refreshControl={
            <AppRefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              enabled={isOnline !== false}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="Todavía no tienes reseñas"
              description="Elige un producto del catálogo para escribir tu primera opinión."
              actionLabel="Explorar catálogo"
              onAction={() => router.navigate('/catalogo')}
            />
          }
          renderItem={({ item }) => (
            <View className="gap-2">
              <AppButton
                label={`Ver producto: ${item.product.nombre}`}
                variant="unstyled"
                className="min-h-11 flex-row items-center justify-between gap-3 py-1"
                onPress={() =>
                  router.push({
                    pathname: '/producto/[id]',
                    params: { id: String(item.product.id) },
                  })
                }
              >
                <Text className="min-w-0 flex-1 font-sans-semibold text-base leading-6 text-primary">
                  {item.product.nombre}
                </Text>
                <ChevronRight aria-hidden size={18} color={colors.textSecondary} />
              </AppButton>
              <View className="flex-row flex-wrap items-center justify-between gap-3">
                <RatingStars rating={item.rating} />
                <AccountStatusBadge kind="review" status={item.status} appearance="inline" />
              </View>
              <Text selectable className="font-sans text-sm leading-6 text-secondary">
                {item.comment}
              </Text>
              <View className="flex-row flex-wrap items-center justify-between gap-3">
                <Text className="font-sans text-xs text-secondary">
                  {accountDate(item.updatedAt)}
                </Text>
                <ReviewEntryButton
                  productId={String(item.product.id)}
                  label="Editar reseña"
                  accessibilityLabel={`Editar reseña de ${item.product.nombre}`}
                  compact
                />
              </View>
            </View>
          )}
        />
      </AccountResourceState>
    </AccountLayout>
  );
}
