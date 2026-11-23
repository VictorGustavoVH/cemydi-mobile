import { useRef, useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import FileText from 'lucide-react-native/icons/file-text';
import Wallet from 'lucide-react-native/icons/wallet';
import RotateCcwClock from 'lucide-react-native/icons/rotate-ccw-clock';
import { ProfileProductRow } from './components/ProfileProductRow';
import { AccountStatusBadge } from '@/components/account/AccountStatusBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppSheet } from '@/components/ui/AppSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton, SkeletonBlock } from '@/components/ui/Skeleton';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/hooks/useToast';
import { getFriendlyErrorMessage, UserFacingError } from '@/services/http/api-error';
import { accountMoney as formatPreviewMoney, accountDate } from './account-format';
import { AccountSection } from '@/components/account/AccountSection';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AccountResourceState } from '@/components/account/AccountResourceState';
import { accountService } from './account-service';
import { useAccountResource } from './useAccountResource';

const day = (date: string) => date.slice(0, 10).split('-').reverse().join('/');
const prescriptionLabels = {
  PENDIENTE: 'Pendiente',
  EN_REVISION: 'En revisión',
  APROBADO: 'Aprobada',
  RECHAZADO: 'Rechazada',
};
const depositLabels = {
  PENDING: 'Pendiente',
  RETURNED: 'Devuelto',
  RETAINED: 'Retenido',
  PARTIALLY_RETAINED: 'Parcialmente retenido',
};

function RentalDetailSkeleton() {
  const { fontScale } = useWindowDimensions();
  const line = (size: number) => ({ height: size * fontScale });
  return (
    <Skeleton label="Cargando detalle de renta">
      <View className="gap-8 px-5 pb-10 pt-6">
        <View className="gap-4">
          <View className="flex-row flex-wrap items-center justify-between gap-3">
            <SkeletonBlock className="w-3/5 rounded" style={line(24)} />
            <SkeletonBlock className="w-24 rounded-full" style={line(32)} />
          </View>
          <SkeletonBlock className="w-40 rounded" style={line(14)} />
        </View>

        <View className="border-t border-border-subtle pt-6">
          <View className="gap-3">
            <SkeletonBlock className="w-2/5 rounded" style={line(18)} />
            <View className="gap-3">
              {[0, 1].map((item) => (
                <View
                  key={item}
                  className={`gap-4 py-3 ${item === 0 ? 'border-b border-border-subtle pb-6' : ''}`}
                >
                  <View className="flex-row items-start gap-3">
                    <SkeletonBlock className="h-14 w-14 rounded-xl" />
                    <View className="flex-1 gap-1">
                      <SkeletonBlock className="w-3/4 rounded" style={line(16)} />
                      <SkeletonBlock className="w-1/2 rounded" style={line(14)} />
                    </View>
                  </View>
                  <View className="flex-row flex-wrap gap-x-6 gap-y-3">
                    {[0, 1].map((column) => (
                      <View key={column} className="min-w-[120px] flex-1 gap-1">
                        <SkeletonBlock className="w-12 rounded" style={line(14)} />
                        <SkeletonBlock className="w-24 rounded" style={line(16)} />
                      </View>
                    ))}
                  </View>
                  <View className="flex-row flex-wrap items-center justify-between gap-2">
                    <SkeletonBlock className="w-32 rounded" style={line(14)} />
                    <SkeletonBlock className="w-20 rounded" style={line(16)} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View className="border-t border-border-subtle pt-6">
          <View className="gap-3">
            <SkeletonBlock className="w-1/2 rounded" style={line(18)} />
            <View className="gap-3">
              {[0, 1].map((row) => (
                <View key={row} className="flex-row flex-wrap justify-between gap-2">
                  <SkeletonBlock className="w-2/5 rounded" style={line(16)} />
                  <SkeletonBlock className="w-24 rounded" style={line(16)} />
                </View>
              ))}
              <View className="mt-2 flex-row flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
                <SkeletonBlock className="w-1/2 rounded" style={line(16)} />
                <SkeletonBlock className="w-28 rounded" style={line(24)} />
              </View>
              <View className="border-t border-border-subtle pt-2">
                <View className="min-h-11 flex-row items-center justify-between gap-3 py-2">
                  <SkeletonBlock className="w-40 rounded" style={line(16)} />
                  <SkeletonBlock className="h-5 w-5 rounded" />
                </View>
              </View>
            </View>
          </View>
        </View>

        <View className="border-t border-border-subtle pt-6">
          <View className="gap-3">
            <SkeletonBlock className="w-1/4 rounded" style={line(18)} />
            <SkeletonBlock className="w-1/2 rounded" style={line(16)} />
            <SkeletonBlock className="w-full rounded" style={line(16)} />
          </View>
        </View>
      </View>
    </Skeleton>
  );
}

export function RentalDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const auth = useAuth();
  const client = useQueryClient();
  const toast = useToast();
  const { query, isOnline, allowed } = useAccountResource(
    ['rental', id],
    (signal) => accountService.rental(id, signal),
    { clientOnly: true, enabled: Boolean(id) && !pending, autoRefresh: true },
  );
  const rental = query.data?.rental;
  async function cancel() {
    if (lock.current || !rental || isOnline === false) return;
    const owner = auth.user?.id;
    const version = auth.getSessionVersion();
    const current = () =>
      auth.getSession().user?.id === owner && auth.getSessionVersion() === version;
    lock.current = true;
    setPending(true);
    try {
      await client.cancelQueries({ queryKey: ['account', owner, 'rental', id] });
      if (!current()) throw new UserFacingError('La sesión cambió. Vuelve a abrir tus rentas.');
      const result = await accountService.cancelRental(id);
      if (!current()) throw new UserFacingError('La sesión cambió. Vuelve a abrir tus rentas.');
      client.setQueryData(['account', owner, 'rental', id], { rental: result.rental });
      void client.invalidateQueries({ queryKey: ['account', owner, 'rentals'] });
      setConfirm(false);
      toast.success(result.message);
    } catch (error) {
      if (current()) {
        setConfirm(false);
        toast.error(getFriendlyErrorMessage(error));
        void query.refetch();
      }
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <AccountLayout title="Detalle de renta">
      {!id ? (
        <EmptyState
          title="Renta no válida"
          description="Regresa al historial y selecciona una solicitud."
        />
      ) : (
        <AccountResourceState
          {...query}
          isOnline={isOnline}
          allowed={allowed}
          loadingFallback={<RentalDetailSkeleton />}
          retry={() => void query.refetch()}
        >
          {rental ? (
            <View className="gap-8 px-5 pb-10 pt-6">
              <View className="gap-4">
                <View className="flex-row flex-wrap items-center justify-between gap-3">
                  <Text
                    accessibilityRole="header"
                    className="min-w-0 shrink font-sans-bold text-2xl text-primary"
                  >
                    {rental.folio ?? 'Solicitud de renta'}
                  </Text>
                  <AccountStatusBadge kind="rental" status={rental.status} />
                </View>
                <Text className="font-sans text-sm leading-5 text-secondary">
                  Solicitada el {accountDate(rental.createdAt)}
                </Text>
                {rental.rejectedReason ? (
                  <View className="gap-1 border-l-2 border-danger pl-3">
                    <Text className="font-sans-semibold text-sm text-danger">
                      Motivo del rechazo
                    </Text>
                    <Text
                      accessibilityLiveRegion="polite"
                      className="font-sans text-sm leading-6 text-secondary"
                    >
                      {rental.rejectedReason}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View className="border-t border-border-subtle pt-6">
                <AccountSection title="Equipos rentados" titleClassName="text-lg">
                  {rental.items.map((item, index) => (
                    <View
                      key={item.id}
                      className={`gap-4 py-3 ${index < rental.items.length - 1 ? 'border-b border-border-subtle pb-6' : ''}`}
                    >
                      <ProfileProductRow
                        name={item.product.nombre}
                        imageUrl={item.product.imageUrl}
                        description={`Cantidad: ${item.quantity} · ${item.days} días`}
                      />
                      <View className="flex-row flex-wrap gap-x-6 gap-y-3">
                        <View className="min-w-[120px] flex-1 gap-1">
                          <Text className="font-sans text-sm text-secondary">Inicio</Text>
                          <Text className="font-sans-medium text-base text-primary">
                            {day(item.startDate)}
                          </Text>
                        </View>
                        <View className="min-w-[120px] flex-1 gap-1">
                          <Text className="font-sans text-sm text-secondary">Devolución</Text>
                          <Text className="font-sans-medium text-base text-primary">
                            {day(item.endDate)}
                          </Text>
                        </View>
                      </View>
                      <View className="flex-row flex-wrap items-center justify-between gap-2">
                        <Text className="font-sans text-sm text-secondary">Importe del equipo</Text>
                        <Text className="font-sans-semibold text-base text-primary">
                          {formatPreviewMoney(item.lineTotal)}
                        </Text>
                      </View>
                      {item.prescription ? (
                        <View className="gap-2 border-t border-border-subtle pt-2">
                          <AccountSection
                            title={`Receta: ${prescriptionLabels[item.prescription.status]}`}
                            icon={FileText}
                            collapsible
                          >
                            <Text selectable className="font-sans text-sm leading-6 text-secondary">
                              {item.prescription.fileName}
                            </Text>
                          </AccountSection>
                          {item.prescription.rejectionReason ? (
                            <Text className="font-sans text-sm leading-5 text-danger">
                              {item.prescription.rejectionReason}
                            </Text>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  ))}
                </AccountSection>
              </View>

              <View className="border-t border-border-subtle pt-6">
                <AccountSection title="Resumen de importes" titleClassName="text-lg">
                  <View className="flex-row flex-wrap justify-between gap-2">
                    <Text className="font-sans text-base text-secondary">Renta</Text>
                    <Text className="font-sans-medium text-base text-primary">
                      {formatPreviewMoney(rental.subtotal)}
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap justify-between gap-2">
                    <Text className="font-sans text-base text-secondary">Depósito</Text>
                    <Text className="font-sans-medium text-base text-primary">
                      {formatPreviewMoney(rental.depositTotal)}
                    </Text>
                  </View>
                  <View className="mt-2 flex-row flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
                    <Text className="font-sans-semibold text-base text-primary">
                      Total de la solicitud
                    </Text>
                    <Text className="font-sans-bold text-2xl text-brand-strong">
                      {formatPreviewMoney(rental.total)}
                    </Text>
                  </View>
                  <View className="border-t border-border-subtle pt-2">
                    <AccountSection title="Detalle del depósito" icon={Wallet} collapsible>
                      <Text className="font-sans text-sm leading-6 text-secondary">
                        Estado: {depositLabels[rental.depositStatus]}
                        {'\n'}Devuelto: {formatPreviewMoney(rental.depositReturnedAmount)}
                        {'\n'}Retenido: {formatPreviewMoney(rental.depositRetainedAmount)}
                      </Text>
                    </AccountSection>
                  </View>
                </AccountSection>
              </View>

              <View className="border-t border-border-subtle pt-6">
                <AccountSection title="Entrega" titleClassName="text-lg">
                  <Text className="font-sans-medium text-base leading-6 text-primary">
                    {rental.deliveryMethod === 'HOME_DELIVERY'
                      ? 'Entrega a domicilio'
                      : rental.deliveryMethod === 'PICKUP'
                        ? 'Recoger en sucursal'
                        : 'Por confirmar'}
                  </Text>
                  {rental.deliveryMethod === 'HOME_DELIVERY' && rental.deliveryAddress ? (
                    <Text selectable className="font-sans text-base leading-6 text-secondary">
                      {rental.deliveryAddress}
                    </Text>
                  ) : null}
                  {rental.notes ? (
                    <View className="gap-1">
                      <Text className="font-sans-medium text-sm text-primary">Notas</Text>
                      <Text className="font-sans text-sm leading-6 text-secondary">
                        {rental.notes}
                      </Text>
                    </View>
                  ) : null}
                </AccountSection>
              </View>

              {rental.statusHistory.length ? (
                <View className="border-t border-border-subtle pt-4">
                  <AccountSection title="Seguimiento" icon={RotateCcwClock} collapsible>
                    <View className="gap-5 border-l border-border pl-4">
                      {rental.statusHistory.map((entry) => (
                        <View key={entry.id} className="gap-2">
                          <AccountStatusBadge
                            kind="rental"
                            status={entry.toStatus}
                            appearance="inline"
                          />
                          <Text className="font-sans text-sm text-secondary">
                            {accountDate(entry.createdAt)}
                          </Text>
                          {entry.note ? (
                            <Text className="font-sans text-sm leading-6 text-secondary">
                              {entry.note}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  </AccountSection>
                </View>
              ) : null}
              {rental.status === 'PENDING' ? (
                <View className="border-t border-border-subtle pt-5">
                  <AppButton
                    label="Cancelar solicitud"
                    variant="ghost"
                    labelClassName="text-danger"
                    disabled={pending || isOnline === false}
                    onPress={() => setConfirm(true)}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </AccountResourceState>
      )}
      <AppSheet
        title="¿Cancelar esta solicitud?"
        visible={confirm && Boolean(rental)}
        onClose={() => {
          if (!pending) setConfirm(false);
        }}
      >
        <Text className="font-sans text-base leading-6 text-secondary">
          Se cancelará esta solicitud pendiente. El servidor comprobará que todavía se puede
          cancelar.
        </Text>
        <AppButton
          label="Confirmar cancelación"
          variant="destructive"
          loading={pending}
          disabled={isOnline === false}
          onPress={() => void cancel()}
        />
        <AppButton
          label="Conservar solicitud"
          variant="ghost"
          disabled={pending}
          onPress={() => setConfirm(false)}
        />
      </AppSheet>
    </AccountLayout>
  );
}
