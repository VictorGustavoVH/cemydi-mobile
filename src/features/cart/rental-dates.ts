import { displayDraftDate, parseDraftDate } from './cart-preview';

const businessDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Mexico_City',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export function rentalToday(now = new Date()) {
  const parts = new Map(businessDate.formatToParts(now).map((part) => [part.type, part.value]));
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`;
}
// Calendar days are independent of UTC timestamps. Native pickers use local Date components.
export function pickerDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}
export function pickerDay(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
export function rentalDateErrors(
  start?: string | null,
  end?: string | null,
  today = rentalToday(),
) {
  const valid = (value?: string | null) =>
    Boolean(value && parseDraftDate(displayDraftDate(value)) === value);
  return {
    start: !valid(start)
      ? 'Selecciona una fecha de inicio.'
      : start! < today
        ? 'La fecha de inicio no puede estar en el pasado.'
        : undefined,
    end: !valid(end)
      ? 'Selecciona una fecha de devolución.'
      : end! < today
        ? 'La fecha de devolución no puede estar en el pasado.'
        : start && end! < start
          ? 'La devolución debe ser igual o posterior al inicio.'
          : undefined,
  };
}
