import { FlatList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppButton } from '@/components/ui/AppButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { AppRefreshControl } from '@/components/ui/AppRefreshControl';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { ProfileLayout } from './components/ProfileLayout';
import { AccountResourceState } from './components/AccountResourceState';
import { accountService } from './account-service';
import { useAccountResource } from './useAccountResource';

const labels = { PENDING: 'En revisión', APPROVED: 'Publicada', REJECTED: 'No publicada' };
export function MyReviewsScreen() {
  const router = useRouter();
  const { query, isOnline } = useAccountResource(['reviews'], accountService.reviews);
  const { refreshing, onRefresh } = usePullToRefresh(query.refetch, {
    enabled: isOnline !== false,
  });
  return (
    <ProfileLayout title="Mis reseñas" scroll={false}>
      <AccountResourceState {...query} isOnline={isOnline} retry={() => void query.refetch()}>
        <FlatList
          data={query.data?.reviews ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 20, gap: 24, flexGrow: 1 }}
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
              description="Las opiniones guardadas en tu cuenta, incluidas las enviadas desde la web, aparecerán aquí con su estado de revisión."
              actionLabel="Explorar catálogo"
              onAction={() => router.navigate('/catalogo')}
            />
          }
          renderItem={({ item }) => (
            <View className="gap-3">
              <View className="flex-row flex-wrap justify-between gap-2">
                <Text className="font-sans-semibold text-base text-primary">
                  {item.product.nombre}
                </Text>
                <Text className="font-sans-medium text-sm text-brand-strong">
                  {labels[item.status]}
                </Text>
              </View>
              <Text
                accessibilityLabel={`${item.rating} de 5 estrellas`}
                className="font-sans-semibold text-base text-primary"
              >
                {item.rating} / 5
              </Text>
              <Text selectable className="font-sans text-base leading-6 text-secondary">
                {item.comment}
              </Text>
              <AppButton
                label={`Ver producto: ${item.product.nombre}`}
                variant="ghost"
                onPress={() =>
                  router.push({
                    pathname: '/producto/[id]',
                    params: { id: String(item.product.id) },
                  })
                }
              />
            </View>
          )}
        />
      </AccountResourceState>
    </ProfileLayout>
  );
}
