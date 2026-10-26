import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppButton } from '@/components/ui/AppButton';
import { AppPagination } from '@/components/ui/AppPagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/providers/auth-provider';
import { accountMoney as formatPreviewMoney } from './account-format';
import { ProfileLayout } from './components/ProfileLayout';
import { AccountResourceState } from './components/AccountResourceState';
import { accountService, rentalLabels } from './account-service';
import { useAccountResource } from './useAccountResource';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

function RentalHistory() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { query, isOnline, allowed } = useAccountResource(
    ['rentals', page],
    (signal) => accountService.rentals(page, signal),
    { clientOnly: true },
  );
  const { refreshing, onRefresh } = usePullToRefresh(query.refetch, {
    enabled: isOnline !== false,
  });
  return (
    <AccountResourceState
      {...query}
      isOnline={isOnline}
      allowed={allowed}
      retry={() => void query.refetch()}
    >
      {query.data?.rentals.length === 0 ? (
        <EmptyState
          title="Sin solicitudes de renta"
          description="Aquí aparecerán las solicitudes guardadas en tu cuenta, también las realizadas en la web."
          actionLabel="Explorar catálogo"
          onAction={() => router.navigate('/catalogo')}
        />
      ) : null}
      <View className="gap-5 px-5 pb-8">
        <AppButton
          label="Actualizar rentas"
          variant="ghost"
          loading={refreshing}
          disabled={isOnline === false}
          onPress={onRefresh}
        />
        {query.data?.rentals.map((rental) => (
          <AppButton
            key={rental.id}
            label={`Ver renta ${rental.folio ?? rental.id}`}
            variant="unstyled"
            className="gap-3 rounded-2xl bg-surface-muted p-4"
            onPress={() =>
              router.push({ pathname: '/perfil/renta/[id]', params: { id: rental.id } })
            }
          >
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <Text className="font-sans-semibold text-base text-primary">
                {rental.folio ?? 'Solicitud de renta'}
              </Text>
              <Text className="font-sans-medium text-sm text-brand-strong">
                {rentalLabels[rental.status]}
              </Text>
            </View>
            <Text className="font-sans text-sm leading-6 text-secondary">
              {rental.items.map((item) => `${item.product.nombre} · ${item.quantity}`).join('\n')}
            </Text>
            <Text className="font-sans-semibold text-base text-primary">
              {formatPreviewMoney(rental.total)}
            </Text>
          </AppButton>
        ))}
        {query.data && query.data.pagination.totalPages > 1 ? (
          <AppPagination
            page={page}
            pageSize={query.data.pagination.pageSize}
            total={query.data.pagination.total}
            disabled={query.isFetching || isOnline === false}
            onPageChange={setPage}
          />
        ) : null}
      </View>
    </AccountResourceState>
  );
}
export function RentalsScreen() {
  const { user } = useAuth();
  return (
    <ProfileLayout title="Mis rentas">
      <RentalHistory key={user?.id ?? 'guest'} />
    </ProfileLayout>
  );
}
