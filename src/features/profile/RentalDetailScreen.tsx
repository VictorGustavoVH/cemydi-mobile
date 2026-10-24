import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { AppButton } from '@/components/ui/AppButton';
import { AppSheet } from '@/components/ui/AppSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/hooks/useToast';
import { getFriendlyErrorMessage, UserFacingError } from '@/services/http/api-error';
import { accountMoney as formatPreviewMoney, accountDate } from './account-format';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { ProfileLayout } from './components/ProfileLayout';
import { AccountResourceState } from './components/AccountResourceState';
import { accountService, rentalLabels } from './account-service';
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
    { clientOnly: true, enabled: Boolean(id) && !pending },
  );
  const rental = query.data?.rental;
  const { refreshing, onRefresh } = usePullToRefresh(query.refetch, {
    enabled: !pending && isOnline !== false,
  });
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
    <ProfileLayout title="Detalle de renta">
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
          retry={() => void query.refetch()}
        >
          {rental ? (
            <View className="gap-6 px-5 pb-8">
              <View className="gap-2">
                <Text className="font-sans-bold text-xl text-primary">
                  {rental.folio ?? 'Solicitud de renta'}
                </Text>
                <Text className="font-sans-semibold text-base text-brand-strong">
                  {rentalLabels[rental.status]}
                </Text>
                <Text className="font-sans text-sm text-secondary">
                  Solicitada el {accountDate(rental.createdAt)}
                </Text>
              </View>
              {rental.rejectedReason ? (
                <Text className="font-sans text-sm text-danger">{rental.rejectedReason}</Text>
              ) : null}
              {rental.items.map((item) => (
                <View key={item.id} className="gap-2 rounded-2xl bg-surface-muted p-4">
                  <Text
                    accessibilityRole="header"
                    className="font-sans-semibold text-base text-primary"
                  >
                    {item.product.nombre}
                  </Text>
                  <Text className="font-sans text-sm leading-6 text-secondary">
                    Cantidad: {item.quantity}
                    {'\n'}
                    {day(item.startDate)} al {day(item.endDate)} · {item.days} días
                  </Text>
                  <Text className="font-sans-semibold text-base text-primary">
                    {formatPreviewMoney(item.lineTotal)}
                  </Text>
                  {item.prescription ? (
                    <Text className="font-sans text-sm leading-6 text-secondary">
                      Receta: {item.prescription.fileName}
                      {'\n'}Estado: {prescriptionLabels[item.prescription.status]}
                      {item.prescription.rejectionReason
                        ? `\n${item.prescription.rejectionReason}`
                        : ''}
                    </Text>
                  ) : null}
                </View>
              ))}
              <View className="gap-2">
                <Text
                  accessibilityRole="header"
                  className="font-sans-semibold text-lg text-primary"
                >
                  Resumen
                </Text>
                <Text className="font-sans text-base text-secondary">
                  Renta: {formatPreviewMoney(rental.subtotal)}
                  {'\n'}Depósito: {formatPreviewMoney(rental.depositTotal)}
                </Text>
                <Text className="font-sans-semibold text-lg text-primary">
                  Total: {formatPreviewMoney(rental.total)}
                </Text>
                <Text className="font-sans text-sm text-secondary">
                  Depósito: {depositLabels[rental.depositStatus]}
                  {'\n'}Devuelto: {formatPreviewMoney(rental.depositReturnedAmount)}
                  {'\n'}Retenido: {formatPreviewMoney(rental.depositRetainedAmount)}
                </Text>
              </View>
              <View className="gap-2">
                <Text
                  accessibilityRole="header"
                  className="font-sans-semibold text-lg text-primary"
                >
                  Entrega
                </Text>
                <Text className="font-sans text-base leading-6 text-secondary">
                  {rental.deliveryMethod === 'HOME_DELIVERY'
                    ? rental.deliveryAddress || 'Entrega a domicilio'
                    : rental.deliveryMethod === 'PICKUP'
                      ? 'Recoger en sucursal'
                      : 'Por confirmar'}
                </Text>
                {rental.notes ? (
                  <Text className="font-sans text-sm text-secondary">{rental.notes}</Text>
                ) : null}
              </View>
              {rental.statusHistory.length ? (
                <View className="gap-3">
                  <Text
                    accessibilityRole="header"
                    className="font-sans-semibold text-lg text-primary"
                  >
                    Seguimiento
                  </Text>
                  {rental.statusHistory.map((entry) => (
                    <View key={entry.id} className="gap-1">
                      <Text className="font-sans-medium text-sm text-primary">
                        {rentalLabels[entry.toStatus]} · {accountDate(entry.createdAt)}
                      </Text>
                      {entry.note ? (
                        <Text className="font-sans text-sm text-secondary">{entry.note}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
              <AppButton
                label="Actualizar renta"
                variant="ghost"
                loading={refreshing}
                disabled={pending || isOnline === false}
                onPress={onRefresh}
              />
              {rental.status === 'PENDING' ? (
                <AppButton
                  label="Cancelar solicitud"
                  variant="outline"
                  disabled={pending || isOnline === false}
                  onPress={() => setConfirm(true)}
                />
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
    </ProfileLayout>
  );
}
