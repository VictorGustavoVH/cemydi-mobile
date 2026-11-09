import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Package from 'lucide-react-native/icons/package';
import { AccountMenuItem } from '@/components/account/AccountMenuItem';
import { AccountSection } from '@/components/account/AccountSection';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AccountResourceState } from '@/components/account/AccountResourceState';
import { useAuth } from '@/providers/auth-provider';
import { notificationService } from './notification-service';
import { useNotificationActions } from './useNotifications';

export function NotificationPromotionScreen({ id }: { id: string }) {
  const router = useRouter();
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
