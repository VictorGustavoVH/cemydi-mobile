import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Clock3 from 'lucide-react-native/icons/clock-3';
import { colors } from '@/theme';
import { AppButton } from './AppButton';

type AppTimeInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
};

export function AppTimeInput({ label, value, onChange, disabled, error }: AppTimeInputProps) {
  const [open, setOpen] = useState(false);
  const selected = new Date();
  const valid = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  const [hour, minute] = valid ? value.split(':').map(Number) : [12, 0];
  selected.setHours(hour, minute, 0, 0);
  const formatted = valid
    ? selected.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true })
    : 'Seleccionar hora';
  function confirm(date: Date) {
    onChange(
      `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
    );
  }
  function change(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS !== 'ios' || event.type === 'dismissed') setOpen(false);
    if (!disabled && event.type === 'set' && date && !Number.isNaN(date.getTime())) confirm(date);
  }
  return (
    <View className="min-w-0 max-w-full shrink gap-2">
      <Text className="font-sans-semibold text-base text-primary">{label}</Text>
      <AppButton
        label={label}
        accessibilityHint={error ?? 'Abre el selector para elegir una hora.'}
        accessibilityValue={{ text: valid ? formatted : 'Sin seleccionar' }}
        accessibilityState={{ expanded: open }}
        variant="unstyled"
        disabled={disabled}
        onPress={() => setOpen((current) => !current)}
        className="min-h-12 flex-row items-center gap-3 rounded-xl border bg-surface px-4 py-3"
        style={{
          width: '100%',
          borderWidth: 1,
          borderColor: error ? colors.inputError : valid ? colors.brand : colors.border,
        }}
      >
        <Clock3
          aria-hidden
          size={20}
          color={
            disabled
              ? colors.disabled
              : error
                ? colors.inputError
                : valid
                  ? colors.brand
                  : colors.textSecondary
          }
        />
        <Text className="min-w-0 flex-1 shrink font-sans text-base text-primary">{formatted}</Text>
      </AppButton>
      {error ? (
        <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-danger">
          {error}
        </Text>
      ) : null}
      {open && !disabled ? (
        <>
          <DateTimePicker
            testID={`Horario ${label}`}
            value={selected}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
            is24Hour={false}
            onChange={change}
          />
          {Platform.OS === 'ios' ? (
            <AppButton
              label="Confirmar hora"
              variant="ghost"
              onPress={() => {
                confirm(selected);
                setOpen(false);
              }}
            />
          ) : null}
        </>
      ) : null}
      {value ? (
        <AppButton
          label="Quitar horario"
          variant="ghost"
          disabled={disabled}
          onPress={() => {
            onChange('');
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}
