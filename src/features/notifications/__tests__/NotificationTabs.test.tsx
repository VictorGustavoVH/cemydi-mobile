import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { NotificationTabs } from '../NotificationTabs';
import { colors } from '@/theme';

it('shows the green underline after layout and moves it to the selected tab', async () => {
  const change = jest.fn();
  const view = await render(<NotificationTabs value="ALL" onChange={change} />);
  await fireEvent(screen.getByLabelText('Filtrar notificaciones'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 51 } },
  });
  expect(
    StyleSheet.flatten(screen.getByTestId('notification-tab-indicator').props.style),
  ).toMatchObject({
    height: 3,
    width: 80,
    opacity: 1,
    backgroundColor: colors.brandStrong,
    transform: [{ translateX: 0 }],
  });
  await fireEvent.press(screen.getByRole('tab', { name: 'Ofertas' }));
  expect(change).toHaveBeenCalledWith('OFFER');
  await view.rerender(<NotificationTabs value="OFFER" onChange={change} />);
  expect(
    StyleSheet.flatten(screen.getByTestId('notification-tab-indicator').props.style),
  ).toMatchObject({ transform: [{ translateX: 240 }] });
});
