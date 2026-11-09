import type { ReactNode } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryTestProvider } from '../../../../tests/support/query-wrapper';
import { productFixture } from '../../../../tests/support/product-fixtures';
import { favoriteService } from '../services/favorite-service';
import { useFavorites } from '../hooks/useFavorites';
import { productDetailKey } from '@/services/products/product-cache';

const mockToast = { error: jest.fn(), info: jest.fn() };
jest.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }));
jest.mock('@/hooks/useAccountAccess', () => ({
  useAccountAccess: () => ({ requestAccess: jest.fn() }),
}));
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 7 },
    getSession: () => ({ user: { id: 7 } }),
    getSessionVersion: () => 1,
  }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function server(initial: boolean) {
  let saved = initial;
  const ids = () => ({ favoriteIds: saved ? [1] : [] });
  jest.spyOn(favoriteService, 'listMyIds').mockImplementation(async () => ids());
  jest.spyOn(favoriteService, 'listMine').mockImplementation(async () => ({
    ...ids(),
    products: saved ? [productFixture(1)] : [],
    total: saved ? 1 : 0,
  }));
  const toggle = jest.spyOn(favoriteService, 'toggle').mockImplementation(async () => {
    saved = !saved;
    return { message: 'Actualizado', productId: 1, favorited: saved };
  });
  return toggle;
}
function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryTestProvider client={client}>{children}</QueryTestProvider>
  );
  return {
    client,
    view: renderHook(() => ({ first: useFavorites(), second: useFavorites() }), { wrapper }),
  };
}

it('no muestra ni siembra productos inactivos recibidos en favoritos', async () => {
  jest.spyOn(favoriteService, 'listMyIds').mockResolvedValue({ favoriteIds: [1, 2] });
  jest.spyOn(favoriteService, 'listMine').mockResolvedValue({
    products: [productFixture(1), productFixture(2, { activo: false })],
    favoriteIds: [1, 2],
    total: 2,
  });
  const { view, client } = setup();
  const { result } = await view;
  await waitFor(() => expect(result.current.first.products).toHaveLength(1));
  expect(result.current.first.products[0].id).toBe(1);
  expect(result.current.first.total).toBe(1);
  expect(client.getQueryData(productDetailKey(1))).toBeDefined();
  expect(client.getQueryData(productDetailKey(2))).toBeUndefined();
});

it.each([true, false])(
  'resuelve favorito=%s antes de cambiarlo y permite operaciones consecutivas',
  async (initial) => {
    const toggle = server(initial);
    const { view, client } = setup();
    const { result } = await view;
    await waitFor(() => expect(result.current.first.idsReady).toBe(true));
    expect(result.current.first.isFavorite(1)).toBe(initial);
    await act(() => result.current.first.toggleFavorite(1));
    await waitFor(() => {
      expect(client.isMutating()).toBe(0);
      expect(result.current.first.isFavorite(1)).toBe(!initial);
    });
    await act(() => result.current.first.toggleFavorite(1));
    await waitFor(() => {
      expect(client.isMutating()).toBe(0);
      expect(result.current.first.isFavorite(1)).toBe(initial);
    });
    expect(toggle).toHaveBeenCalledTimes(2);
  },
);

it('bloquea carga pendiente y usa los ids de la lista cuando esa respuesta llega primero', async () => {
  const toggle = server(true);
  const list = deferred<Awaited<ReturnType<typeof favoriteService.listMine>>>();
  const ids = deferred<Awaited<ReturnType<typeof favoriteService.listMyIds>>>();
  jest.spyOn(favoriteService, 'listMine').mockReturnValueOnce(list.promise);
  jest.spyOn(favoriteService, 'listMyIds').mockReturnValueOnce(ids.promise);
  const { view, client } = setup();
  const { result } = await view;
  expect(result.current.first.idsReady).toBe(false);
  await act(() => result.current.first.toggleFavorite(1));
  expect(toggle).not.toHaveBeenCalled();
  await act(() => list.resolve({ products: [productFixture(1)], favoriteIds: [1], total: 1 }));
  await waitFor(() => expect(result.current.first.idsReady).toBe(true));
  await act(() => result.current.first.toggleFavorite(1));
  await waitFor(() => {
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(client.isMutating()).toBe(0);
    expect(result.current.first.isPendingToggle).toBe(false);
    expect(result.current.first.isFavorite(1)).toBe(false);
  });
  await act(() => ids.resolve({ favoriteIds: [] }));
});

it('impide toggles duplicados incluso entre dos consumidores y restaura el estado al fallar', async () => {
  const toggle = server(true);
  const pending = deferred<Awaited<ReturnType<typeof favoriteService.toggle>>>();
  toggle.mockReturnValueOnce(pending.promise);
  const { view } = setup();
  const { result } = await view;
  await waitFor(() => expect(result.current.first.idsReady).toBe(true));
  await act(() => {
    result.current.first.toggleFavorite(1);
    result.current.first.toggleFavorite(1);
    result.current.second.toggleFavorite(1);
  });
  expect(toggle).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(result.current.first.isFavorite(1)).toBe(false));
  await act(() => pending.reject(new Error('Sin red')));
  await waitFor(() => expect(result.current.first.isPendingToggle).toBe(false));
  expect(result.current.first.isFavorite(1)).toBe(true);
  expect(mockToast.error).toHaveBeenCalledWith('No se pudo actualizar tu lista de favoritos.');
});

it('mantiene deshabilitada la operación si las dos lecturas fallan', async () => {
  const toggle = server(false);
  jest.spyOn(favoriteService, 'listMine').mockRejectedValue(new Error('Error remoto'));
  jest.spyOn(favoriteService, 'listMyIds').mockRejectedValue(new Error('Error remoto'));
  const { view } = setup();
  const { result } = await view;
  await waitFor(() => expect(result.current.first.isError).toBe(true));
  expect(result.current.first.idsReady).toBe(false);
  await act(() => result.current.first.toggleFavorite(1));
  expect(toggle).not.toHaveBeenCalled();
});
