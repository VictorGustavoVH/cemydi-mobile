import { fireEvent, screen } from '@testing-library/react-native';

export async function selectCalendarDate(label: string, value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  await fireEvent.press(screen.getByLabelText(label));
  await fireEvent(
    screen.getByTestId(`Calendario ${label}`),
    'onValueChange',
    { nativeEvent: { timestamp: date.getTime(), utcOffset: 0 } },
    date,
  );
  const confirm = screen.queryByLabelText(`Confirmar ${label.toLowerCase()}`);
  if (confirm) await fireEvent.press(confirm);
}
