import { useSafeNavigation } from '@/hooks/useSafeNavigation';
import { useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { colors } from '@/theme';
import { AppPagination } from '@/components/ui/AppPagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton, SkeletonBlock } from '@/components/ui/Skeleton';
import { useAuth } from '@/providers/auth-provider';
import { accountMoney as formatPreviewMoney, accountDate } from './account-format';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AccountResourceState } from '@/components/account/AccountResourceState';
import { AppButton } from '@/components/ui/AppButton';
import { ProfileProductRow } from './components/ProfileProductRow';
import { AccountStatusBadge } from '@/components/account/AccountStatusBadge';
import { accountService } from './account-service';
import { useAccountResource } from './useAccountResource';

function RentalsSkeleton() {
  const { fontScale } = useWindowDimensions();
  return (
    <Skeleton label="Cargando tus rentas">
      <View className="gap-4 px-5 pb-8 pt-6">
        {[0, 1].map((card) => (
          <View key={card} className="gap-3 rounded-2xl border border-border-subtle bg-surface p-4">
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <SkeletonBlock className="w-2/5 rounded" style={{ height: 16 * fontScale }} />
              <SkeletonBlock className="w-20 rounded-full" style={{ height: 20 * fontScale }} />
            </View>
            <SkeletonBlock className="w-32 rounded" style={{ height: 12 * fontScale }} />
            {[0, 1].map((row) => (
              <View key={row} className="flex-row items-start gap-3">
                <SkeletonBlock className="h-14 w-14 rounded-xl" />
                <View className="flex-1 gap-1">
                  <SkeletonBlock className="w-3/4 rounded" style={{ height: 16 * fontScale }} />
                  <SkeletonBlock className="w-1/2 rounded" style={{ height: 14 * fontScale }} />
                </View>
              </View>
            ))}
            <View className="flex-row flex-wrap items-center justify-between gap-3 pt-1">
              <View className="gap-1">
                <SkeletonBlock className="w-28 rounded" style={{ height: 12 * fontScale }} />
                <SkeletonBlock className="w-24 rounded" style={{ height: 18 * fontScale }} />
              </View>
              <View className="flex-row items-center gap-1">
                <SkeletonBlock className="w-20 rounded" style={{ height: 14 * fontScale }} />
                <SkeletonBlock className="h-[18px] w-[18px] rounded" />
              </View>
            </View>
          </View>
        ))}
      </View>
    </Skeleton>
  );
}

function RentalHistory() {
  const router = useSafeNavigation();
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
      loadingFallback={<RentalsSkeleton />}
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
      <View className="gap-4 px-5 pb-8 pt-6">
        {query.data?.rentals.map((rental) => (
          <AppButton
            key={rental.id}
            label={`Ver renta ${rental.folio ?? rental.id}`}
            accessibilityHint="Abre los equipos, importes, entrega y seguimiento de esta solicitud."
            variant="unstyled"
            className="gap-3 rounded-2xl border border-border-subtle bg-surface p-4"
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
    <AccountLayout title="Mis rentas" appearance="grouped">
      <RentalHistory key={user?.id ?? 'guest'} />
    </AccountLayout>
  );
}
