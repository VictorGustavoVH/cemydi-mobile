import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { hasCompletedOnboarding } from '../onboarding-progress';
import { OnboardingGate } from '../OnboardingGate';

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native') as typeof import('react-native');
    return <Text>{`Destino: ${href}`}</Text>;
  },
}));
jest.mock('../OnboardingScreen', () => ({
  OnboardingScreen: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native') as typeof import('react-native');
    return <Text>Introducción</Text>;
  },
}));
jest.mock('../onboarding-progress', () => ({ hasCompletedOnboarding: jest.fn() }));

beforeEach(() => jest.mocked(hasCompletedOnboarding).mockReset());

it('muestra onboarding en el primer arranque, sin parpadear Inicio durante la lectura', async () => {
  let resolveRead: (value: boolean) => void = () => undefined;
  jest
    .mocked(hasCompletedOnboarding)
    .mockImplementationOnce(() => new Promise<boolean>((resolve) => (resolveRead = resolve)));
  await render(<OnboardingGate />);
  expect(screen.getByText('Preparando la aplicación')).toBeTruthy();
  expect(screen.queryByText('Destino: /inicio')).toBeNull();
  await act(async () => resolveRead(false));
  await screen.findByText('Introducción');
});

it('va directo a Inicio tras completar onboarding, sin mostrar una diapositiva', async () => {
  let resolveRead: (value: boolean) => void = () => undefined;
  jest
    .mocked(hasCompletedOnboarding)
    .mockImplementationOnce(() => new Promise<boolean>((resolve) => (resolveRead = resolve)));
  await render(<OnboardingGate />);
  expect(screen.queryByText('Introducción')).toBeNull();
  await act(async () => resolveRead(true));
  await screen.findByText('Destino: /inicio');
  expect(screen.queryByText('Introducción')).toBeNull();
});

it('no repite la introducción al volver a abrir la ruta inicial tras completar el recorrido', async () => {
  jest.mocked(hasCompletedOnboarding).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const firstLaunch = await render(<OnboardingGate />);
  await screen.findByText('Introducción');
  await firstLaunch.unmount();

  await render(<OnboardingGate />);
  await screen.findByText('Destino: /inicio');
  expect(screen.queryByText('Introducción')).toBeNull();
  expect(hasCompletedOnboarding).toHaveBeenCalledTimes(2);
});

it('permite reintentar una lectura fallida sin asumir que es un usuario nuevo', async () => {
  jest
    .mocked(hasCompletedOnboarding)
    .mockRejectedValueOnce(new Error('No disponible'))
    .mockResolvedValueOnce(true);
  await render(<OnboardingGate />);
  await screen.findByText('No pudimos comprobar la introducción');
  expect(screen.queryByText('Introducción')).toBeNull();
  await fireEvent.press(screen.getByText('Reintentar'));
  await waitFor(() => expect(screen.getByText('Destino: /inicio')).toBeTruthy());
  expect(hasCompletedOnboarding).toHaveBeenCalledTimes(2);
});
