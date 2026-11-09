import { render, screen } from '@testing-library/react-native';
import { AccountLayout } from '../AccountLayout';
import { Text } from 'react-native';

let mockFocused = true;
const mockNavigate = jest.fn();
const mockToast = { info: jest.fn() };
const mockRouter = { navigate: mockNavigate };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    const focused = mockFocused;
    useEffect(() => (focused ? callback() : undefined), [callback, focused]);
  },
}));
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ status: 'guest', user: null }),
}));
jest.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }));

it('no monta encabezado, datos ni spinner de Perfil para un invitado y redirige de nuevo al recuperar foco', async () => {
  const view = await render(
    <AccountLayout title="Mi perfil" main>
      <Text>Datos privados</Text>
    </AccountLayout>,
  );
  expect(mockNavigate).toHaveBeenCalledWith('/inicio');
  expect(screen.queryByText('Mi perfil')).toBeNull();
  expect(screen.queryByText('Datos privados')).toBeNull();
  expect(screen.queryByText('Volviendo al inicio…')).toBeNull();
  mockFocused = false;
  await view.rerender(
    <AccountLayout title="Mi perfil" main>
      <Text>Datos privados</Text>
    </AccountLayout>,
  );
  mockNavigate.mockClear();
  mockFocused = true;
  await view.rerender(
    <AccountLayout title="Mi perfil" main>
      <Text>Datos privados</Text>
    </AccountLayout>,
  );
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});
