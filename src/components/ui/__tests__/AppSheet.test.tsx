import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppSheet } from '../AppSheet';

it.each(['sheet', 'dialog'] as const)(
  'extiende el fondo de %s bajo ambas barras del sistema',
  async (presentation) => {
    const view = await render(
      <AppSheet visible presentation={presentation} title="Formulario" onClose={jest.fn()}>
        <Text>Contenido</Text>
      </AppSheet>,
    );
    const root = view.root;
    const modal =
      root &&
      [root, ...root.queryAll(() => true)].find((node) =>
        ['Modal', 'RCTModalHostView'].includes(node.type),
      );
    expect(modal).toBeTruthy();
    expect(modal).toHaveProp('statusBarTranslucent', true);
    expect(modal).toHaveProp('navigationBarTranslucent', true);
    expect(modal).toHaveProp('transparent', true);
    expect(screen.getByRole('header', { name: 'Formulario' })).toBeTruthy();
  },
);

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
