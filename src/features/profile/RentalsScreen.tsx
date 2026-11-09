import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { colors } from '@/theme';
import { AppPagination } from '@/components/ui/AppPagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/providers/auth-provider';
import { accountMoney as formatPreviewMoney, accountDate } from './account-format';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AccountResourceState } from '@/components/account/AccountResourceState';
import { AppButton } from '@/components/ui/AppButton';
import { ProfileProductRow } from './components/ProfileProductRow';
import { AccountStatusBadge } from '@/components/account/AccountStatusBadge';
import { accountService } from './account-service';
import { useAccountResource } from './useAccountResource';

function RentalHistory() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { query, isOnline, allowed } = useAccountResource(
    ['rentals', page],
    (signal) => accountService.rentals(page, signal),
    { clientOnly: true, keepPreviousData: true, autoRefresh: true },
  );
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
          description="Consulta aquí el estado de tus solicitudes."
          actionLabel="Explorar catálogo"
          onAction={() => router.navigate('/catalogo')}
        />
      ) : null}
      <View className="px-5 pb-8">
        {query.data?.rentals.map((rental) => (
          <AppButton
            key={rental.id}
            label={`Ver renta ${rental.folio ?? rental.id}`}
            accessibilityHint="Abre los equipos, importes, entrega y seguimiento de esta solicitud."
            variant="unstyled"
            className="gap-3 border-b border-border py-5"
            onPress={() =>
              router.push({ pathname: '/perfil/renta/[id]', params: { id: rental.id } })
            }
          >
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <Text className="font-sans-semibold text-base text-primary">
                {rental.folio ?? 'Solicitud de renta'}
              </Text>
              <AccountStatusBadge kind="rental" status={rental.status} appearance="inline" />
            </View>
            <Text className="font-sans text-xs text-secondary">
              Solicitada el {accountDate(rental.createdAt)}
            </Text>
            {rental.items.slice(0, 2).map((item) => (
              <ProfileProductRow
                key={item.id}
                name={item.product.nombre}
                imageUrl={item.product.imageUrl}
                description={`Cantidad: ${item.quantity} · ${item.days} días`}
              />
            ))}
            {rental.items.length > 2 ? (
              <Text className="font-sans text-sm text-secondary">
                Y {rental.items.length - 2}{' '}
                {rental.items.length === 3 ? 'equipo más' : 'equipos más'}
              </Text>
            ) : null}
            <View className="flex-row flex-wrap items-center justify-between gap-3 pt-1">
              <View className="gap-1">
                <Text className="font-sans text-xs text-secondary">Total de la solicitud</Text>
                <Text className="font-sans-semibold text-lg text-primary">
                  {formatPreviewMoney(rental.total)}
                </Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Text className="font-sans-medium text-sm text-secondary">Ver detalle</Text>
                <ChevronRight aria-hidden size={18} color={colors.textSecondary} />
              </View>
            </View>
          </AppButton>
        ))}
        {query.data && query.data.pagination.totalPages > 1 ? (
          <AppPagination
            page={Math.min(query.data.pagination.page, query.data.pagination.totalPages)}
            totalPages={query.data.pagination.totalPages}
            disabled={query.isFetching || isOnline === false}
            loading={query.isPlaceholderData}
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
    <AccountLayout title="Mis rentas">
      <RentalHistory key={user?.id ?? 'guest'} />
    </AccountLayout>
  );
}
