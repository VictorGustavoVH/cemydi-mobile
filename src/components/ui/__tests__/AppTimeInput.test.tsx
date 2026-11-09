import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { AppTimeInput } from '../AppTimeInput';

describe('AppTimeInput', () => {
  it('abre el reloj nativo, confirma HH:mm e ignora la cancelación en Android', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const change = jest.fn();
    await render(<AppTimeInput label="Recogida" value="" onChange={change} />);
    await fireEvent.press(screen.getByLabelText('Recogida'));
    expect(screen.getByTestId('Horario Recogida')).toHaveProp('mode', 'time');
    expect(screen.getByTestId('Horario Recogida')).toHaveProp('display', 'clock');
    await fireEvent(screen.getByTestId('Horario Recogida'), 'onChange', { type: 'dismissed' });
    expect(change).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Recogida'));
    await fireEvent(
      screen.getByTestId('Horario Recogida'),
      'onChange',
      { type: 'set' },
      new Date(2027, 0, 1, 13, 5),
    );
    expect(change).toHaveBeenCalledWith('13:05');
    expect(screen.queryByTestId('Horario Recogida')).toBeNull();
  });

  it('ofrece ruedas y confirmación en iOS y permite quitar la hora opcional', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const change = jest.fn();
    const view = await render(<AppTimeInput label="Recogida" value="13:05" onChange={change} />);
    await fireEvent.press(screen.getByLabelText('Recogida'));
    expect(screen.getByTestId('Horario Recogida')).toHaveProp('display', 'spinner');
    await fireEvent.press(screen.getByLabelText('Confirmar hora'));
    expect(change).toHaveBeenCalledWith('13:05');
    await fireEvent.press(screen.getByLabelText('Quitar horario'));
    expect(change).toHaveBeenLastCalledWith('');
    await view.rerender(<AppTimeInput label="Recogida" value="" onChange={change} disabled />);
    await fireEvent.press(screen.getByLabelText('Recogida'));
    expect(screen.queryByTestId('Horario Recogida')).toBeNull();
  });
});
