import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import { colors } from '@/theme';
import { AppButton } from './AppButton';

type AppDateInputProps = {
  label: string;
  value?: Date;
  minimumDate: Date;
  onChange: (value: Date) => void;
  disabled?: boolean;
  error?: string;
};
export function AppDateInput({
  label,
  value,
  minimumDate,
  onChange,
  disabled = false,
  error,
}: AppDateInputProps) {
  const [open, setOpen] = useState(false);
  const selected = value && value >= minimumDate ? value : minimumDate;
  const formatted = value?.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const completed = Boolean(
    value && !Number.isNaN(value.getTime()) && value >= minimumDate && !error,
  );
  function change(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS !== 'ios' || event.type === 'dismissed') setOpen(false);
    if (disabled || event.type !== 'set' || !date || Number.isNaN(date.getTime())) return;
    // Normalize to a calendar day, avoiding midnight/DST shifts when comparing the native result.
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
    if (day >= minimumDate) onChange(day);
  }
  return (
    <View className="min-w-0 max-w-full shrink gap-2">
      <Text className="font-sans-semibold text-base text-primary">{label}</Text>
      <AppButton
        label={label}
        accessibilityHint={error ?? 'Abre el calendario para seleccionar una fecha.'}
        accessibilityValue={{ text: formatted ?? 'Sin seleccionar' }}
        accessibilityState={{ expanded: open }}
        disabled={disabled}
        variant="unstyled"
        onPress={() => setOpen((current) => !current)}
        className={`min-h-12 flex-row items-center gap-3 rounded-xl border bg-surface px-4 py-3 ${error ? 'border-danger' : completed ? 'border-brand' : 'border-border'}`}
        style={{
          minWidth: 0,
          width: '100%',
          borderWidth: 1,
          borderColor: error ? colors.inputError : completed ? colors.brand : colors.border,
        }}
      >
        <CalendarDays
          aria-hidden
          size={20}
          color={
            disabled
              ? colors.disabled
              : error
                ? colors.inputError
                : completed
                  ? colors.brand
                  : colors.textSecondary
          }
        />
        <Text className="min-w-0 flex-1 shrink font-sans text-base text-primary">
          {formatted ?? 'Seleccionar fecha'}
        </Text>
      </AppButton>
      {error ? (
        <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-danger">
          {error}
        </Text>
      ) : null}
      {open && !disabled ? (
        <>
          <DateTimePicker
            testID={`Calendario ${label}`}
            value={selected}
            minimumDate={minimumDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
            onChange={change}
          />
          {Platform.OS === 'ios' ? (
            <AppButton
              label={`Confirmar ${label.toLowerCase()}`}
              variant="ghost"
              onPress={() => {
                if (!disabled) onChange(selected);
                setOpen(false);
              }}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}
