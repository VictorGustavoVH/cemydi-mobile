import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppBottomBar } from '../AppBottomBar';

describe('AppBottomBar', () => {
  const onHome = jest.fn();
  const onExplore = jest.fn();
  const onCart = jest.fn();
  const onProfile = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renderiza todas las pestañas principales', async () => {
    await render(
      <AppBottomBar onHome={onHome} onExplore={onExplore} onCart={onCart} onProfile={onProfile} />,
    );

    expect(screen.getByRole('button', { name: 'Inicio' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Explorar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Carrito' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Perfil' })).toBeTruthy();
  });

  it('muestra el contador del carrito en la etiqueta accesible y el badge', async () => {
    await render(
      <AppBottomBar
        cartCount={5}
        onHome={onHome}
        onExplore={onExplore}
        onCart={onCart}
        onProfile={onProfile}
      />,
    );

    expect(screen.getByRole('button', { name: 'Carrito, 5 unidades' })).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('muestra 99+ cuando el contador supera 99', async () => {
    await render(
      <AppBottomBar
        cartCount={120}
        onHome={onHome}
        onExplore={onExplore}
        onCart={onCart}
        onProfile={onProfile}
      />,
    );

    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('ejecuta los callbacks al presionar cada pestaña', async () => {
    await render(
      <AppBottomBar onHome={onHome} onExplore={onExplore} onCart={onCart} onProfile={onProfile} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Inicio' }));
    expect(onHome).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Explorar' }));
    expect(onExplore).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Carrito' }));
    expect(onCart).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Perfil' }));
    expect(onProfile).toHaveBeenCalledTimes(1);
  });

  it('respeta la pestaña seleccionada vía selectedTab', async () => {
    await render(
      <AppBottomBar
        selectedTab="cart"
        onHome={onHome}
        onExplore={onExplore}
        onCart={onCart}
        onProfile={onProfile}
      />,
    );

    const cartButton = screen.getByRole('button', { name: 'Carrito', selected: true });
    expect(cartButton).toBeTruthy();
  });
});
