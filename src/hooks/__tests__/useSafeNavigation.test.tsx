import { act, renderHook } from '@testing-library/react-native';
import { useSafeNavigation } from '../useSafeNavigation';
import { NavigationGuardProvider } from '@/providers/navigation-guard-provider';
import type { ReactNode } from 'react';

const mockRouter = {
  push: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

let now: number;
beforeEach(() => {
  jest.clearAllMocks();
  now = 0;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
});

function Wrapper({ children }: { children: ReactNode }) {
  return <NavigationGuardProvider>{children}</NavigationGuardProvider>;
}

it('bloquea inmediatamente push y navigate entre consumidores, incluso hacia otra ruta', async () => {
  const { result } = await renderHook(() => [useSafeNavigation(), useSafeNavigation()], {
    wrapper: Wrapper,
  });
  const href = { pathname: '/producto/[id]', params: { id: '101' } } as const;
  await act(() => {
    result.current[0].push(href, { withAnchor: true });
    result.current[0].push(href);
    result.current[1].navigate('/perfil');
  });
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
  expect(mockRouter.push).toHaveBeenCalledWith(href, { withAnchor: true });
  expect(mockRouter.navigate).not.toHaveBeenCalled();
  now = 799;
  await act(() => result.current[1].navigate('/perfil'));
  expect(mockRouter.navigate).not.toHaveBeenCalled();
  now = 800;
  await act(() => result.current[1].navigate('/perfil'));
  expect(mockRouter.navigate).toHaveBeenCalledWith('/perfil');
});

it('conserva el bloqueo al renderizar de nuevo y permite configurar el intervalo', async () => {
  const { result, rerender } = await renderHook(() => useSafeNavigation(1200), {
    wrapper: Wrapper,
  });
  await act(() => result.current.navigate('/catalogo'));
  await rerender({});
  now = 1199;
  await act(() => result.current.push('/perfil'));
  expect(mockRouter.push).not.toHaveBeenCalled();
  now = 1200;
  await act(() => result.current.push('/perfil'));
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
});

it('respeta el intervalo del proveedor y no requiere timers', async () => {
  const { result } = await renderHook(() => useSafeNavigation(), {
    wrapper: ({ children }) => (
      <NavigationGuardProvider intervalMs={1500}>{children}</NavigationGuardProvider>
    ),
  });
  await act(() => result.current.push('/perfil'));
  now = 800;
  await act(() => result.current.push('/perfil'));
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
  now = 1500;
  await act(() => result.current.push('/perfil'));
  expect(mockRouter.push).toHaveBeenCalledTimes(2);
});

it('libera el bloqueo si el router lanza un error síncrono', async () => {
  const error = new Error('Navigator not mounted');
  mockRouter.push.mockImplementationOnce(() => {
    throw error;
  });
  const { result } = await renderHook(() => useSafeNavigation(), { wrapper: Wrapper });
  expect(() => result.current.push('/perfil')).toThrow(error);
  result.current.navigate('/catalogo');
  expect(mockRouter.navigate).toHaveBeenCalledWith('/catalogo');
});

it('preserva replace, back y las consultas del router durante el bloqueo', async () => {
  const { result } = await renderHook(() => useSafeNavigation(), { wrapper: Wrapper });
  result.current.push('/perfil');
  result.current.replace('/login');
  result.current.back();
  expect(result.current.canGoBack()).toBe(true);
  expect(mockRouter.replace).toHaveBeenCalledWith('/login');
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});

it('una nueva raíz empieza desbloqueada y no hereda navegación de otra sesión de la app', async () => {
  const first = await renderHook(() => useSafeNavigation(), { wrapper: Wrapper });
  first.result.current.push('/perfil');
  await first.unmount();
  const second = await renderHook(() => useSafeNavigation(), { wrapper: Wrapper });
  second.result.current.push('/perfil');
  expect(mockRouter.push).toHaveBeenCalledTimes(2);
});
