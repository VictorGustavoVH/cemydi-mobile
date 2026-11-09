import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppSheet } from '../AppSheet';

it('el diálogo propio bloquea cierre y Atrás durante una operación', async () => {
  const close = jest.fn();
  const view = await render(
    <AppSheet visible presentation="dialog" title="Confirmar" onClose={close} closeDisabled>
      <Text>Procesando</Text>
    </AppSheet>,
  );
  expect(screen.getByRole('header', { name: 'Confirmar' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled();
  await fireEvent(screen.getByText('Procesando'), 'requestClose');
  await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
  expect(close).not.toHaveBeenCalled();
  await view.rerender(
    <AppSheet visible presentation="dialog" title="Confirmar" onClose={close}>
      <Text>Disponible</Text>
    </AppSheet>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
  expect(close).toHaveBeenCalledTimes(1);
});
