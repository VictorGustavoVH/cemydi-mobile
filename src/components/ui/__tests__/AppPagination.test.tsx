import { fireEvent, screen } from '@testing-library/react-native';
import { render } from '../../../../tests/support/render-with-toast';
import { AppPagination } from '../AppPagination';
import { AppSwitch } from '../AppSwitch';

describe('Paginación y switch', () => {
  it('navega a los extremos y muestra la página actual en una sola fila', async () => {
    const change = jest.fn();
    await render(<AppPagination page={3} totalPages={5} onPageChange={change} />);
    expect(screen.getByRole('button', { name: 'Página 3 de 5' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Primera página' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Última página' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(change.mock.calls).toEqual([[1], [5], [4]]);
  });
  it('valida el salto desde la hoja y acepta una página de destino existente', async () => {
    const change = jest.fn();
    await render(<AppPagination page={1} totalPages={5} onPageChange={change} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Página 1 de 5' }));
    const input = screen.getByLabelText('Página de destino (1 a 5)');
    await fireEvent.changeText(input, '6');
    await fireEvent.press(screen.getByRole('button', { name: 'Ir' }));
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByText('Escribe una página del 1 al 5.')).toBeTruthy();
    await fireEvent.changeText(input, '5');
    await fireEvent.press(screen.getByRole('button', { name: 'Ir' }));
    expect(change).toHaveBeenCalledWith(5);
    expect(screen.queryByLabelText('Página de destino (1 a 5)')).toBeNull();
  });
  it('bloquea navegación en los extremos y durante carga', async () => {
    const change = jest.fn();
    const view = await render(<AppPagination page={1} totalPages={1} onPageChange={change} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Primera página', disabled: true }));
    await fireEvent.press(screen.getByRole('button', { name: 'Página siguiente', disabled: true }));
    expect(change).not.toHaveBeenCalled();
    await view.rerender(<AppPagination page={2} totalPages={5} disabled onPageChange={change} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Última página', disabled: true }));
    expect(change).not.toHaveBeenCalled();
  });
  it('expone el estado del switch y respeta disabled', async () => {
    const change = jest.fn();
    const view = await render(<AppSwitch label="Ofertas" value onValueChange={change} />);
    await fireEvent.press(screen.getByRole('switch', { name: 'Ofertas', checked: true }));
    expect(change).toHaveBeenCalledWith(false);
    await view.rerender(
      <AppSwitch label="Ofertas" value={false} disabled onValueChange={change} />,
    );
    await fireEvent.press(screen.getByRole('switch', { name: 'Ofertas', disabled: true }));
    expect(change).toHaveBeenCalledTimes(1);
  });
});
