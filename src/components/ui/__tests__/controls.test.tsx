import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppButton } from '../AppButton';
import { AppInput } from '../AppInput';
import { EmptyState } from '../EmptyState';
import { ErrorState } from '../ErrorState';
import { LoadingState } from '../LoadingState';
import { OfflineState } from '../OfflineState';

describe('Controles y feedback compartidos', () => {
  it('ejecuta la acción y la bloquea durante loading o disabled conservando el nombre', async () => {
    const onPress = jest.fn();
    const view = await render(<AppButton label="Guardar" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    await view.rerender(<AppButton label="Guardar" onPress={onPress} loading />);
    expect(
      screen.getByRole('button', { name: 'Guardar', busy: true, disabled: true }),
    ).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Guardar'));
    await view.rerender(<AppButton label="Guardar" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar', disabled: true }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('expone input etiquetado, interacción y error accesible en lugar de ayuda', async () => {
    const onChangeText = jest.fn();
    const view = await render(
      <AppInput label="Notas" helperText="Opcional" onChangeText={onChangeText} />,
    );
    await fireEvent.changeText(screen.getByLabelText('Notas'), 'Entrega por la mañana');
    expect(onChangeText).toHaveBeenCalledWith('Entrega por la mañana');
    await view.rerender(<AppInput label="Notas" helperText="Opcional" error="Revisa el texto" />);
    expect(screen.getByLabelText('Notas')).toHaveProp('accessibilityHint', 'Revisa el texto');
    expect(screen.getByLabelText('Notas')).toHaveProp('aria-invalid', true);
    expect(screen.queryByText('Opcional')).toBeNull();
    expect(screen.getByText('Revisa el texto')).toBeTruthy();
  });

  it('permite recuperación desde empty y error', async () => {
    const action = jest.fn();
    const view = await render(<EmptyState actionLabel="Explorar" onAction={action} />);
    expect(screen.getByRole('header', { name: 'No hay nada por aquí' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Explorar' }));
    await view.rerender(<ErrorState description="Servicio no disponible" onRetry={action} />);
    expect(screen.getByText('Servicio no disponible')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('presenta loading y offline sin ofrecer operaciones inexistentes', async () => {
    const view = await render(<LoadingState label="Cargando catálogo…" />);
    expect(screen.getByLabelText('Cargando catálogo…')).toBeTruthy();
    await view.rerender(<OfflineState />);
    expect(screen.getByRole('header', { name: 'Sin conexión' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
