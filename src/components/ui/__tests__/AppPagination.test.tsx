import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppPagination } from '../AppPagination';
import { AppSwitch } from '../AppSwitch';

describe('Paginación y switch', () => {
  it('navega a los extremos, pagina por número y muestra el rango real', async () => {
    const change = jest.fn();
    await render(<AppPagination page={3} total={93} pageSize={20} onPageChange={change} />);
    expect(screen.getByText('41–60 de 93 resultados')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Primera página' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Última página' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Página 2' }));
    expect(change.mock.calls).toEqual([[1], [5], [2]]);
  });
  it('valida el salto y acepta una página de destino existente', async () => {
    const change = jest.fn();
    await render(<AppPagination page={1} total={93} pageSize={20} onPageChange={change} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ir a página' }));
    const input = screen.getByLabelText('Página de destino (1 a 5)');
    await fireEvent.changeText(input, '6');
    await fireEvent.press(screen.getByRole('button', { name: 'Ir' }));
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByText('Escribe una página del 1 al 5.')).toBeTruthy();
    await fireEvent.changeText(input, '5');
    await fireEvent.press(screen.getByRole('button', { name: 'Ir' }));
    expect(change).toHaveBeenCalledWith(5);
  });
  it('bloquea navegación sin resultados y durante carga', async () => {
    const change = jest.fn();
    const view = await render(
      <AppPagination page={1} total={0} pageSize={20} onPageChange={change} />,
    );
    expect(screen.getByText('0–0 de 0 resultados')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Página siguiente', disabled: true }));
    await view.rerender(
      <AppPagination page={2} total={90} pageSize={20} onPageChange={change} disabled />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Primera página', disabled: true }));
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
