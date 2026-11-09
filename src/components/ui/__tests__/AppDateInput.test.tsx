import { render, screen, fireEvent } from '@testing-library/react-native';
import { AppDateInput } from '../AppDateInput';
import { colors } from '@/theme';

describe('AppDateInput', () => {
  it('marca la selección válida y prioriza errores manteniendo el tamaño del borde', async () => {
    const minimumDate = new Date(2026, 9, 30, 12);
    const view = await render(
      <AppDateInput
        label="Inicio"
        minimumDate={minimumDate}
        value={minimumDate}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('Inicio')).toHaveStyle({
      borderColor: colors.brand,
      borderWidth: 1,
    });
    await view.rerender(
      <AppDateInput
        label="Inicio"
        minimumDate={minimumDate}
        value={minimumDate}
        error="Revisa la fecha"
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('Inicio')).toHaveStyle({
      borderColor: colors.inputError,
      borderWidth: 1,
    });
  });
  it('abre el calendario con fecha mínima e ignora una selección pasada o cancelada', async () => {
    const change = jest.fn();
    const minimumDate = new Date(2026, 9, 30, 12);
    await render(<AppDateInput label="Inicio" minimumDate={minimumDate} onChange={change} />);
    await fireEvent.press(screen.getByLabelText('Inicio'));
    const picker = screen.getByTestId('Calendario Inicio');
    expect(picker).toHaveProp('minimumDate', minimumDate);
    await fireEvent(picker, 'onChange', { type: 'set' }, new Date(2026, 9, 29, 12));
    expect(change).not.toHaveBeenCalled();
    if (!screen.queryByTestId('Calendario Inicio'))
      await fireEvent.press(screen.getByLabelText('Inicio'));
    await fireEvent(screen.getByTestId('Calendario Inicio'), 'onChange', { type: 'dismissed' });
    expect(change).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Inicio'));
    await fireEvent(
      screen.getByTestId('Calendario Inicio'),
      'onChange',
      { type: 'set' },
      new Date(2026, 9, 30, 0),
    );
    expect(change).toHaveBeenCalledWith(minimumDate);
  });
  it('no abre el selector deshabilitado y muestra el error de un valor previo inválido', async () => {
    await render(
      <AppDateInput
        label="Inicio"
        value={new Date(2026, 9, 29, 12)}
        minimumDate={new Date(2026, 9, 30, 12)}
        disabled
        error="La fecha ya pasó."
        onChange={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Inicio'));
    expect(screen.queryByTestId('Calendario Inicio')).toBeNull();
    expect(screen.getByText('La fecha ya pasó.')).toBeTruthy();
  });
});
