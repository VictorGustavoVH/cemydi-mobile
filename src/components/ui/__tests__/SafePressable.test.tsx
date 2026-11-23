import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafePressable } from '../SafePressable';
import { AppButton } from '../AppButton';
import { BaseExpoRouterLink as Link } from 'expo-router/build/link/BaseExpoRouterLink';
import { NavigationGuardProvider } from '@/providers/navigation-guard-provider';

const mockNavigate = jest.fn();
jest.mock('expo-router/build/Prefetch', () => ({ Prefetch: () => null }));
jest.mock('expo-router/build/link/useLinkToPathProps', () => ({
  __esModule: true,
  default: ({ href }: { href: string }) => ({
    href,
    role: 'link',
    onPress: () => mockNavigate(href),
  }),
}));

let now: number;
beforeEach(() => {
  jest.clearAllMocks();
  now = 0;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
});

it('Link asChild dispara una sola navegación y conserva clases, rol y etiqueta', async () => {
  const onPress = jest.fn();
  await render(
    <Link href="/perfil" asChild>
      <SafePressable
        className="rounded-2xl bg-surface p-4"
        accessibilityLabel="Abrir perfil"
        onPress={onPress}
      >
        <Text>Perfil</Text>
      </SafePressable>
    </Link>,
  );
  const target = screen.getByRole('link', { name: 'Abrir perfil' });
  await act(async () => {
    await fireEvent.press(target);
    await fireEvent.press(target);
    await fireEvent.press(target);
  });
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith('/perfil');
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(target).toHaveProp('className', 'rounded-2xl bg-surface p-4');
  now = 800;
  await fireEvent.press(target);
  expect(mockNavigate).toHaveBeenCalledTimes(2);
});

it('AppButton también admite Link asChild sin bloquear controles normales', async () => {
  const increment = jest.fn();
  await render(
    <>
      <Link href="/perfil" asChild>
        <AppButton label="Mi perfil" />
      </Link>
      <AppButton label="Aumentar cantidad" onPress={increment} />
    </>,
  );
  await fireEvent.press(screen.getByLabelText('Mi perfil'));
  await fireEvent.press(screen.getByLabelText('Mi perfil'));
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByLabelText('Aumentar cantidad'));
  await fireEvent.press(screen.getByLabelText('Aumentar cantidad'));
  expect(increment).toHaveBeenCalledTimes(2);
});

it('dos enlaces distintos comparten el bloqueo de la raíz', async () => {
  await render(
    <NavigationGuardProvider>
      <Link href="/perfil" asChild>
        <SafePressable accessibilityLabel="Perfil">
          <Text>Perfil</Text>
        </SafePressable>
      </Link>
      <Link href="/catalogo" asChild>
        <AppButton label="Catálogo" />
      </Link>
    </NavigationGuardProvider>,
  );
  await fireEvent.press(screen.getByLabelText('Perfil'));
  await fireEvent.press(screen.getByLabelText('Catálogo'));
  expect(mockNavigate.mock.calls).toEqual([['/perfil']]);
  now = 800;
  await fireEvent.press(screen.getByLabelText('Catálogo'));
  expect(mockNavigate.mock.calls).toEqual([['/perfil'], ['/catalogo']]);
});

it('respeta disabled, estados accesibles e intervalo configurable', async () => {
  const action = jest.fn();
  const { rerender } = await render(
    <SafePressable
      accessibilityRole="button"
      accessibilityLabel="Continuar"
      accessibilityState={{ disabled: true }}
      disabled
      pressIntervalMs={1200}
      onPress={action}
    />,
  );
  await fireEvent.press(screen.getByLabelText('Continuar'));
  expect(action).not.toHaveBeenCalled();
  await rerender(
    <SafePressable accessibilityLabel="Continuar" pressIntervalMs={1200} onPress={action} />,
  );
  await fireEvent.press(screen.getByLabelText('Continuar'));
  now = 1199;
  await fireEvent.press(screen.getByLabelText('Continuar'));
  expect(action).toHaveBeenCalledTimes(1);
  now = 1200;
  await fireEvent.press(screen.getByLabelText('Continuar'));
  expect(action).toHaveBeenCalledTimes(2);
});
