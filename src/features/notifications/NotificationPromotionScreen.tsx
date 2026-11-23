import { useSafeNavigation } from '@/hooks/useSafeNavigation';
import { Text, useWindowDimensions, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Package from 'lucide-react-native/icons/package';
import { AccountMenuItem } from '@/components/account/AccountMenuItem';
import { AccountSection } from '@/components/account/AccountSection';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AccountResourceState } from '@/components/account/AccountResourceState';
import { Skeleton, SkeletonBlock } from '@/components/ui/Skeleton';
import { useAuth } from '@/providers/auth-provider';
import { notificationService } from './notification-service';
import { useNotificationActions } from './useNotifications';

function NotificationPromotionSkeleton() {
  const { fontScale } = useWindowDimensions();
  return (
    <Skeleton label="Cargando oferta">
      <View className="gap-5 px-5 py-6">
        <SkeletonBlock className="w-3/4 rounded" style={{ height: 20 * fontScale }} />
        <SkeletonBlock className="w-1/3 rounded" style={{ height: 18 * fontScale }} />
        <SkeletonBlock className="w-2/5 rounded" style={{ height: 14 * fontScale }} />
        <View className="gap-3">
          <SkeletonBlock className="w-1/2 rounded" style={{ height: 16 * fontScale }} />
          <View>
            {[0, 1, 2].map((row) => (
              <View
                key={row}
                className="min-h-20 flex-row items-center gap-3 border-b border-border py-4"
              >
                <View className="w-8 items-center justify-center">
                  <SkeletonBlock className="h-6 w-6 rounded" />
                </View>
                <View className="flex-1 gap-1">
                  <SkeletonBlock className="w-2/3 rounded" style={{ height: 16 * fontScale }} />
                  <SkeletonBlock className="w-24 rounded" style={{ height: 14 * fontScale }} />
                </View>
                <SkeletonBlock className="h-[18px] w-[18px] rounded" />
              </View>
            ))}
          </View>
        </View>
      </View>
    </Skeleton>
  );
}

export function NotificationPromotionScreen({ id }: { id: string }) {
  const router = useSafeNavigation();
  const { user, status } = useAuth();
  const actions = useNotificationActions();
  const allowed = status === 'authenticated' && user?.rol === 'CLIENT';
  const query = useQuery({
    queryKey: ['notifications', user?.id, 'promotion', id],
    queryFn: ({ signal }) => notificationService.promotion(id, signal),
    enabled: allowed && !!id,
    gcTime: 0,
  });
  const promotion = query.data?.promotion;
  return (
    <AccountLayout title="Oferta CEMYDI">
      <AccountResourceState
        data={query.data}
        error={query.error}
        isError={query.isError}
        isOnline={actions.isOnline}
        allowed={allowed}
        loadingFallback={<NotificationPromotionSkeleton />}
        retry={() => void query.refetch()}
      >
        {promotion && (
          <View className="gap-5 px-5 py-6">
            <Text accessibilityRole="header" className="font-sans-bold text-xl text-primary">
              {promotion.description || 'Oferta CEMYDI'}
            </Text>
            <Text className="font-sans-semibold text-lg text-brand-strong">
              {promotion.discountPercent}% de descuento
            </Text>
            <Text className="font-sans text-sm text-secondary">
              Hasta {new Date(promotion.endAt).toLocaleDateString('es-MX')}
            </Text>
            <AccountSection title="Productos de la oferta">
              {promotion.products.map((product) => (
                <AccountMenuItem
                  key={product.id}
                  title={product.nombre}
                  description="Ver producto"
                  appearance="divided"
                  iconTone="info"
                  icon={Package}
                  onPress={() =>
                    router.push({ pathname: '/producto/[id]', params: { id: product.id } })
                  }
                />
              ))}
            </AccountSection>
          </View>
        )}
      </AccountResourceState>
    </AccountLayout>
  );
}
