import { AppState, StyleSheet } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { AppSpinner } from '../AppSpinner';
import { AppButton } from '../AppButton';

it('anuncia una carga indeterminada y desaparece al terminar', async () => {
  const view = await render(<AppSpinner label="Preparando tu cuenta" />);
  expect(
    screen.getByRole('progressbar', { name: 'Preparando tu cuenta', busy: true }),
  ).toBeTruthy();
  await view.rerender(<AppSpinner animating={false} />);
  expect(screen.queryByRole('progressbar')).toBeNull();
});
it('el spinner de un botón mantiene una sola acción accesible y bloqueada', async () => {
  await render(<AppButton label="Guardar cambios" loading />);
  expect(
    screen.getByRole('button', { name: 'Guardar cambios', busy: true, disabled: true }),
  ).toBeTruthy();
  expect(screen.queryByRole('progressbar')).toBeNull();
});
it('con movimiento reducido conserva el indicador y su anuncio', async () => {
  jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
  await render(<AppSpinner label="Cargando datos" />);
  expect(screen.getByRole('progressbar', { name: 'Cargando datos', busy: true })).toBeTruthy();
});
it('retira la escucha de segundo plano al ocultarse y al desmontarse', async () => {
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove });
  const view = await render(<AppSpinner />);
  expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  await view.rerender(<AppSpinner animating={false} />);
  expect(remove).toHaveBeenCalledTimes(1);
  await view.rerender(<AppSpinner />);
  await act(async () => {
    await view.unmount();
  });
  expect(remove).toHaveBeenCalledTimes(2);
});

it.each([18, 22, 40])('alinea pista y arco con el mismo radio a tamaño %s', async (size) => {
  await render(<AppSpinner size={size} />);
  const root = screen.getByRole('progressbar');
  const track = root.children[0];
  if (typeof track !== 'object') throw new Error('Falta la pista de carga');
  const style = StyleSheet.flatten(track.props.style);
  const radius = (size - style.inset * 2 - style.borderWidth) / 2;
  expect(radius).toBeCloseTo((size * 9) / 24);
});

it('anima con estado inicial desconocido, pausa en segundo plano y reanuda al volver', async () => {
  const initialState = AppState.currentState;
  const listener = jest.spyOn(AppState, 'addEventListener');
  try {
    AppState.currentState = 'unknown';
    await render(<AppSpinner />);
    const animationStyle = () => {
      const child = screen.getByRole('progressbar').children[1];
      if (typeof child !== 'object') throw new Error('Falta el arco de carga');
      return StyleSheet.flatten(child.props.style);
    };
    expect(animationStyle().animationPlayState).toBe('running');
    await act(() => {
      AppState.currentState = 'background';
      listener.mock.calls[0][1]('background');
    });
    expect(animationStyle().animationPlayState).toBe('paused');
    await act(() => {
      AppState.currentState = 'active';
      listener.mock.calls[0][1]('active');
    });
    expect(animationStyle().animationPlayState).toBe('running');
  } finally {
    AppState.currentState = initialState;
  }
});
