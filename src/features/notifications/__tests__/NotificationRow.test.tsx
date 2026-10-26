import { fireEvent, render, screen } from '@testing-library/react-native';
import { NotificationRow } from '../NotificationRow';
import { notificationTime } from '../notification-presentation';

const item = {
  id: 'notice',
  category: 'OFFER' as const,
  title: 'Equipo en oferta',
  body: 'Consulta todos los detalles de la promoción.',
  destinationType: 'PROMOTION' as const,
  destinationId: '2',
  createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
  readAt: null,
  preview: { imageUrl: null, discountPercent: 20 },
};
describe('notification anatomy', () => {
  it('opens the destination by tapping the row without separate action controls', async () => {
    const open = jest.fn();
    await render(<NotificationRow item={item} onOpen={open} onRead={jest.fn()} />);
    expect(screen.getByText('-20%')).toBeTruthy();
    expect(screen.getByText('Hace 10 min')).toBeTruthy();
    expect(screen.getByText(item.title)).toHaveProp('numberOfLines', 2);
    expect(screen.getByText(item.body)).toHaveProp('numberOfLines', 2);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText('Ver oferta')).toBeNull();
    expect(screen.queryByText('Revisar cuenta')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: `${item.title}, sin leer` }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: `Marcar como leída: ${item.title}` })).toBeNull();
  });
  it('expands a complete message inline and marks it read without navigation', async () => {
    const read = jest.fn();
    const open = jest.fn();
    await render(
      <NotificationRow
        item={{ ...item, destinationType: 'NONE', destinationId: null }}
        onRead={read}
        onOpen={open}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: `${item.title}, sin leer` }));
    expect(screen.getByText(item.body).props.numberOfLines).toBeUndefined();
    expect(read).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: `${item.title}, sin leer` }));
    expect(screen.getByText(item.body)).toHaveProp('numberOfLines', 2);
    expect(read).toHaveBeenCalledTimes(1);
  });
  it('reveals a long message first and opens the destination on the second tap', async () => {
    const open = jest.fn();
    const read = jest.fn();
    await render(<NotificationRow item={item} onOpen={open} onRead={read} />);
    expect(open).toHaveBeenCalledTimes(0);
    await fireEvent(
      screen.getByTestId('notification-body-measure', { includeHiddenElements: true }),
      'textLayout',
      { nativeEvent: { lines: [{}, {}, {}, {}] } },
    );
    await fireEvent.press(screen.getByRole('button', { name: `${item.title}, sin leer` }));
    expect(open).not.toHaveBeenCalled();
    expect(read).toHaveBeenCalledTimes(1);
    expect(screen.getByText(item.body).props.numberOfLines).toBeUndefined();
    await fireEvent.press(screen.getByRole('button', { name: `${item.title}, sin leer` }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(1);
  });
  it('formats older times without long calendar dates', () => {
    const now = Date.now();
    expect(notificationTime(new Date(now - 86400000).toISOString(), now)).toBe('Ayer');
    expect(notificationTime(new Date(now - 60 * 86400000).toISOString(), now)).toBe('Hace 2 meses');
    expect(notificationTime('invalid', now)).toBe('Recientemente');
  });
});
