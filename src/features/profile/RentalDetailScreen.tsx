import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import ReceiptText from 'lucide-react-native/icons/receipt-text';
import MapPin from 'lucide-react-native/icons/map-pin';
import FileText from 'lucide-react-native/icons/file-text';
import Wallet from 'lucide-react-native/icons/wallet';
import RotateCcwClock from 'lucide-react-native/icons/rotate-ccw-clock';
import { colors } from '@/theme';
import { ProfileProductRow } from './components/ProfileProductRow';
import { AccountStatusBadge } from '@/components/account/AccountStatusBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppSheet } from '@/components/ui/AppSheet';
import { EmptyState } from '@/components/ui/EmptyState';
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
          retry={() => void query.refetch()}
        >
          {rental ? (
            <View className="gap-6 px-5 pb-8 pt-5">
              <View className="gap-2">
                <Text className="font-sans-semibold text-lg text-primary">
                  {rental.folio ?? 'Solicitud de renta'}
                </Text>
                <AccountStatusBadge kind="rental" status={rental.status} appearance="inline" />
                <Text className="font-sans text-sm text-secondary">
                  Solicitada el {accountDate(rental.createdAt)}
                </Text>
              </View>
              {rental.rejectedReason ? (
                <Text
                  accessibilityLiveRegion="polite"
                  className="font-sans text-sm leading-6 text-danger"
                >
                  {rental.rejectedReason}
                </Text>
              ) : null}
              {rental.items.map((item) => (
                <View key={item.id} className="gap-3 border-t border-border pt-4">
                  <ProfileProductRow
                    name={item.product.nombre}
                    imageUrl={item.product.imageUrl}
                    description={`Cantidad: ${item.quantity} · ${item.days} días`}
                  >
                    <View className="flex-row items-start gap-1.5">
                      <CalendarDays aria-hidden size={16} color={colors.info} />
                      <Text className="min-w-0 flex-1 font-sans text-xs leading-5 text-secondary">
                        Del {day(item.startDate)} al {day(item.endDate)}
                      </Text>
                    </View>
                    <Text className="font-sans text-xs leading-5 text-secondary">
                      Importe del equipo
                    </Text>
                    <Text className="font-sans-semibold text-base text-primary">
                      {formatPreviewMoney(item.lineTotal)}
                    </Text>
                  </ProfileProductRow>
                  {item.prescription ? (
                    <>
                      <AccountSection
                        title={`Receta: ${prescriptionLabels[item.prescription.status]}`}
                        icon={FileText}
                        iconTone="textSecondary"
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
                    </>
                  ) : null}
                </View>
              ))}
              <View className="border-t border-border pt-4">
                <AccountSection title="Resumen de importes" icon={ReceiptText} iconTone="info">
                  <View className="flex-row flex-wrap justify-between gap-2">
                    <Text className="font-sans text-sm text-secondary">Renta</Text>
                    <Text className="font-sans-medium text-sm text-primary">
                      {formatPreviewMoney(rental.subtotal)}
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap justify-between gap-2">
                    <Text className="font-sans text-sm text-secondary">Depósito</Text>
                    <Text className="font-sans-medium text-sm text-primary">
                      {formatPreviewMoney(rental.depositTotal)}
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap items-center justify-between gap-2 pt-1">
                    <Text className="font-sans-semibold text-base text-primary">
                      Total de la solicitud
                    </Text>
                    <Text className="font-sans-semibold text-lg text-primary">
                      {formatPreviewMoney(rental.total)}
                    </Text>
                  </View>
                  <AccountSection
                    title="Detalle del depósito"
                    icon={Wallet}
                    iconTone="warning"
                    collapsible
                  >
                    <Text className="font-sans text-sm leading-6 text-secondary">
                      Estado: {depositLabels[rental.depositStatus]}
                      {'\n'}Devuelto: {formatPreviewMoney(rental.depositReturnedAmount)}
                      {'\n'}Retenido: {formatPreviewMoney(rental.depositRetainedAmount)}
                    </Text>
                  </AccountSection>
                </AccountSection>
              </View>
              <View className="border-t border-border pt-5">
                <AccountSection title="Entrega" icon={MapPin} iconTone="warning">
                  <Text className="font-sans-medium text-sm leading-6 text-primary">
                    {rental.deliveryMethod === 'HOME_DELIVERY'
                      ? 'Entrega a domicilio'
                      : rental.deliveryMethod === 'PICKUP'
                        ? 'Recoger en sucursal'
                        : 'Por confirmar'}
                  </Text>
                  {rental.deliveryMethod === 'HOME_DELIVERY' && rental.deliveryAddress ? (
                    <Text selectable className="font-sans text-sm leading-6 text-secondary">
                      {rental.deliveryAddress}
                    </Text>
                  ) : null}
                  {rental.notes ? (
                    <Text className="font-sans text-sm leading-6 text-secondary">
                      Notas: {rental.notes}
                    </Text>
                  ) : null}
                </AccountSection>
              </View>
              {rental.statusHistory.length ? (
                <View className="border-t border-border pt-4">
                  <AccountSection
                    title="Seguimiento"
                    icon={RotateCcwClock}
                    iconTone="info"
                    collapsible
                  >
                    {rental.statusHistory.map((entry) => (
                      <View key={entry.id} className="gap-1">
                        <AccountStatusBadge
                          kind="rental"
                          status={entry.toStatus}
                          appearance="inline"
                        />
                        <Text className="font-sans text-xs text-secondary">
                          {accountDate(entry.createdAt)}
                        </Text>
                        {entry.note ? (
                          <Text className="font-sans text-sm text-secondary">{entry.note}</Text>
                        ) : null}
                      </View>
                    ))}
                  </AccountSection>
                </View>
              ) : null}
              {rental.status === 'PENDING' ? (
                <AppButton
                  label="Cancelar solicitud"
                  variant="ghost"
                  labelClassName="text-danger"
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
    </AccountLayout>
  );
}
