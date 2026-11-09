import { useState } from 'react';
import { Text, View } from 'react-native';
import FileText from 'lucide-react-native/icons/file-text';
import { AppButton } from '@/components/ui/AppButton';
import { AppDateInput } from '@/components/ui/AppDateInput';
import { pickerDate, pickerDay, rentalDateErrors } from '../rental-dates';
import { useRentalToday } from '../useRentalToday';
import { AppInput } from '@/components/ui/AppInput';
import { AppSheet } from '@/components/ui/AppSheet';
import { useCart } from '@/providers/cart-provider';
import { useToast } from '@/hooks/useToast';
import { getFriendlyErrorMessage } from '@/services/http/api-error';
import { colors } from '@/theme';
import { CartPrescription } from './CartPrescription';
import { type CartPreviewEntry } from '../cart-preview';

type RentalConfigurationSheetProps = CartPreviewEntry & {
  onClose: () => void;
};
export function RentalConfigurationSheet({
  item,
  product,
  onClose,
}: RentalConfigurationSheetProps) {
  const { saveRentalDraft, connected, busy, online, uncertain, cart } = useCart();
  const serverItem = cart?.items.find((line) => line.id === item.serverId);
  const toast = useToast();
  const today = useRentalToday();
  const [start, setStart] = useState(item.rentalDraft?.startDate);
  const [end, setEnd] = useState(item.rentalDraft?.endDate);
  const [notes, setNotes] = useState(item.rentalDraft?.notes ?? '');
  const [prescriptionBusy, setPrescriptionBusy] = useState(false);
  const working = busy || prescriptionBusy;
  const [errors, setErrors] = useState<{ start?: string; end?: string; file?: string }>({});
  const fileError = serverItem?.document ? undefined : errors.file;

  async function save() {
    if (working) return;
    const nextErrors: { start?: string; end?: string; file?: string } = {
      ...rentalDateErrors(start, end, today),
    };
    if (product.prescription && connected && !serverItem?.document) {
      nextErrors.file = 'Debes adjuntar el archivo para guardar la configuración.';
    }
    setErrors(nextErrors);
    if (!start || !end || nextErrors.start || nextErrors.end || nextErrors.file) return;
    try {
      await saveRentalDraft(
        item.productId,
        { startDate: start, endDate: end, notes: notes.trim() },
        item.serverId,
      );
      onClose();
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error));
    }
  }
  return (
    <AppSheet visible title="Configurar renta" onClose={onClose} closeDisabled={working}>
      <View className="gap-1">
        <Text className="font-sans-semibold text-lg text-primary">{product.name}</Text>
        <Text className="font-sans text-sm leading-6 text-secondary">
          {product.rental?.price} MXN / día por unidad · Mínimo: {product.rental?.minimum}
        </Text>
        <Text className="font-sans text-sm text-secondary">
          Depósito por unidad: {product.rental?.deposit} MXN
        </Text>
      </View>
      <AppDateInput
        label="Fecha de inicio"
        value={start ? pickerDate(start) : undefined}
        minimumDate={pickerDate(today)}
        disabled={busy || (connected && (!online || uncertain))}
        error={errors.start ?? (start ? rentalDateErrors(start, end, today).start : undefined)}
        onChange={(date) => {
          const next = pickerDay(date);
          setStart(next);
          setErrors((prev) => ({ ...prev, start: undefined }));
          if (end && end < next) setEnd(undefined);
        }}
      />
      <AppDateInput
        label="Fecha de devolución"
        value={end ? pickerDate(end) : undefined}
        minimumDate={pickerDate(start && start > today ? start : today)}
        disabled={busy || !start || (connected && (!online || uncertain))}
        error={errors.end ?? (end ? rentalDateErrors(start, end, today).end : undefined)}
        onChange={(date) => {
          setEnd(pickerDay(date));
          setErrors((prev) => ({ ...prev, end: undefined }));
        }}
      />
      <AppInput
        label="Notas de la renta (opcional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="¿Hay algo que debamos saber?"
        multiline
        maxLength={500}
      />
      {product.prescription && connected && serverItem ? (
        <View className="gap-1">
          <CartPrescription item={serverItem} onBusyChange={setPrescriptionBusy} />
          {fileError ? (
            <Text accessibilityLiveRegion="polite" className="font-sans text-xs text-danger">
              {fileError}
            </Text>
          ) : null}
        </View>
      ) : product.prescription ? (
        <View className="gap-2 rounded-2xl bg-surface-muted p-4">
          <View className="flex-row items-center gap-2">
            <FileText aria-hidden color={colors.brandStrong} size={20} />
            <Text className="flex-1 font-sans-semibold text-sm text-primary">Receta requerida</Text>
          </View>
          <Text className="font-sans text-sm leading-6 text-secondary">
            Archivo obligatorio. Inicia sesión para adjuntar una receta en PDF, JPG, PNG o WebP,
            hasta 8 MB.
          </Text>
        </View>
      ) : null}
      <Text className="font-sans text-sm leading-6 text-secondary">
        {connected
          ? 'Al guardar, confirmaremos las fechas, la disponibilidad y el importe. Tu solicitud se envía en el siguiente paso.'
          : 'Guarda tus fechas para continuar. Confirmaremos la disponibilidad y el importe cuando inicies sesión.'}
      </Text>
      {product.rental?.terms ? (
        <Text className="font-sans text-sm text-secondary">{product.rental.terms}</Text>
      ) : null}
      <AppButton
        label={connected ? 'Guardar configuración' : 'Guardar borrador'}
        loading={busy}
        disabled={prescriptionBusy || (connected && (!online || uncertain))}
        onPress={() => void save()}
        className="rounded-full"
      />
    </AppSheet>
  );
}
