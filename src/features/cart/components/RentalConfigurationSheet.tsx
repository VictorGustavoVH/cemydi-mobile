import { useState } from 'react';
import { Text, View } from 'react-native';
import FileText from 'lucide-react-native/icons/file-text';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppSheet } from '@/components/ui/AppSheet';
import { useCatalogPreview } from '@/providers/catalog-preview-provider';
import { colors } from '@/theme';
import {
  displayDraftDate,
  formatDraftDateInput,
  parseDraftDate,
  type CartPreviewEntry,
} from '../cart-preview';

type RentalConfigurationSheetProps = CartPreviewEntry & { onClose: () => void };
export function RentalConfigurationSheet({
  item,
  product,
  onClose,
}: RentalConfigurationSheetProps) {
  const { saveRentalDraft } = useCatalogPreview();
  const [start, setStart] = useState(
    item.rentalDraft ? displayDraftDate(item.rentalDraft.startDate) : '',
  );
  const [end, setEnd] = useState(
    item.rentalDraft ? displayDraftDate(item.rentalDraft.endDate) : '',
  );
  const [notes, setNotes] = useState(item.rentalDraft?.notes ?? '');
  const [errors, setErrors] = useState<{ start?: string; end?: string }>({});
  function save() {
    const startDate = parseDraftDate(start);
    const endDate = parseDraftDate(end);
    const nextErrors = {
      start: startDate ? undefined : 'Escribe una fecha válida: DD/MM/AAAA.',
      end: !endDate
        ? 'Escribe una fecha válida: DD/MM/AAAA.'
        : startDate && endDate < startDate
          ? 'La devolución debe ser igual o posterior al inicio.'
          : undefined,
    };
    setErrors(nextErrors);
    if (!startDate || !endDate || nextErrors.start || nextErrors.end) return;
    saveRentalDraft(item.productId, { startDate, endDate, notes: notes.trim() });
    onClose();
  }
  return (
    <AppSheet visible title="Configurar renta" onClose={onClose}>
      <View className="gap-1">
        <Text className="font-sans-semibold text-lg text-primary">{product.name}</Text>
        <Text className="font-sans text-sm leading-6 text-secondary">
          {product.rental?.price} MXN / día por unidad · Mínimo: {product.rental?.minimum}
        </Text>
        <Text className="font-sans text-sm text-secondary">
          Depósito por unidad: {product.rental?.deposit} MXN
        </Text>
      </View>
      <AppInput
        label="Fecha de inicio"
        value={start}
        onChangeText={(value) => setStart(formatDraftDateInput(value))}
        placeholder="DD/MM/AAAA"
        maxLength={10}
        autoCorrect={false}
        keyboardType="number-pad"
        error={errors.start}
      />
      <AppInput
        label="Fecha de devolución"
        value={end}
        onChangeText={(value) => setEnd(formatDraftDateInput(value))}
        placeholder="DD/MM/AAAA"
        maxLength={10}
        autoCorrect={false}
        keyboardType="number-pad"
        error={errors.end}
      />
      <AppInput
        label="Notas de la renta (opcional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="¿Hay algo que debamos saber?"
        multiline
        maxLength={500}
      />
      {product.prescription ? (
        <View className="gap-2 rounded-2xl bg-surface-muted p-4">
          <View className="flex-row items-center gap-2">
            <FileText aria-hidden color={colors.brandStrong} size={20} />
            <Text className="flex-1 font-sans-semibold text-sm text-primary">Receta requerida</Text>
          </View>
          <Text className="font-sans text-sm leading-6 text-secondary">
            Podrás adjuntarla al habilitar tu cuenta. PDF, JPG o PNG, hasta 8 MB. Aún no hay una
            receta adjunta.
          </Text>
        </View>
      ) : null}
      <Text className="font-sans text-sm leading-6 text-secondary">
        Estas fechas se guardan como borrador en esta sesión. La disponibilidad, el periodo mínimo y
        el importe se confirmarán antes de enviar la solicitud.
      </Text>
      <AppButton label="Guardar borrador" onPress={save} className="rounded-full" />
    </AppSheet>
  );
}
