import { act, waitFor } from '@testing-library/react-native';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { render } from '../support/render-with-toast';
import { AUTH_ACCOUNT, AUTH_USER, installAuthApiMock } from '../support/auth-api-mock';
import { CatalogPreviewProvider, useCatalogPreview } from '@/providers/catalog-preview-provider';
import { useAuth } from '@/providers/auth-provider';
import { FavoritesLifecycle } from '@/features/favorites/FavoritesLifecycle';
import { favoriteService } from '@/features/favorites/services/favorite-service';
import { ApiError } from '@/services/http/api-error';
import { useFavorites } from '@/features/favorites/hooks/useFavorites';
import { productFixture } from '../support/product-fixtures';
import { useEffect, type ReactNode } from 'react';

jest.mock('@/hooks/useAccountAccess', () => ({
  useAccountAccess: () => ({ requestAccess: jest.fn() }),
}));

let controls: { auth: ReturnType<typeof useAuth>; guest: ReturnType<typeof useCatalogPreview> };
function Controls() {
  const auth = useAuth();
  const guest = useCatalogPreview();
  useEffect(() => {
    controls = { auth, guest };
  }, [auth, guest]);
  return null;
}
let accountFavorites: ReturnType<typeof useFavorites>;
function AccountFavoriteControls() {
  const favorites = useFavorites();
  useEffect(() => {
    accountFavorites = favorites;
  }, [favorites]);
  return null;
}
async function setup(ids = ['1', '2'], extra?: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = await render(
    <CatalogPreviewProvider>
      <FavoritesLifecycle />
      <Controls />
      {extra}
    </CatalogPreviewProvider>,
    { client },
  );
  await act(() => {
    ids.forEach((id) => controls.guest.toggleFavorite(id));
  });
  return { view, client };
}
const login = () => controls.auth.service.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, false);
beforeEach(() => {
  focusManager.setFocused(true);
  onlineManager.setOnline(true);
  installAuthApiMock();
});

it('respeta una eliminación explícita de la cuenta tras una transferencia con resultado incierto', async () => {
  let stored = true;
  const add = jest
    .spyOn(favoriteService, 'add')
    .mockRejectedValue(new ApiError('Sin respuesta', { kind: 'network' }));
  jest.spyOn(favoriteService, 'listMine').mockImplementation(async () => ({
    products: stored ? [productFixture(1)] : [],
    favoriteIds: stored ? [1] : [],
    total: stored ? 1 : 0,
  }));
  jest
    .spyOn(favoriteService, 'listMyIds')
    .mockImplementation(async () => ({ favoriteIds: stored ? [1] : [] }));
  jest.spyOn(favoriteService, 'toggle').mockImplementation(async () => {
    stored = !stored;
    return { productId: 1, favorited: stored, message: 'Actualizado' };
  });
  const { client } = await setup(['1'], <AccountFavoriteControls />);
  await act(async () => {
    await login();
  });
  await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(client.isMutating()).toBe(0));
  await waitFor(() => expect(accountFavorites.idsReady).toBe(true));
  expect(controls.guest.favorites).toEqual(['1']);
  await act(() => accountFavorites.toggleFavorite(1));
  await waitFor(() => expect(controls.guest.favorites).toEqual([]));
  expect(stored).toBe(false);
  await act(() => focusManager.setFocused(false));
  await act(() => focusManager.setFocused(true));
  expect(add).toHaveBeenCalledTimes(1);
});
afterEach(() => {
  onlineManager.setOnline(true);
  focusManager.setFocused(true);
});

it('transfiere una vez al iniciar sesión, conserva favoritos previos y limpia solo los confirmados', async () => {
  const stored = new Set([2]);
  const add = jest.spyOn(favoriteService, 'add').mockImplementation(async (id) => {
    stored.add(id);
    return { productId: id, favorited: true, message: 'Guardado' };
  });
  const toggle = jest.spyOn(favoriteService, 'toggle');
  const { client } = await setup();
  const invalidation = jest.spyOn(client, 'invalidateQueries');
  expect(add).not.toHaveBeenCalled();
  await act(async () => {
    await login();
  });
  await waitFor(() => expect(controls.guest.favorites).toEqual([]));
  expect(add.mock.calls.map(([id]) => id)).toEqual([1, 2]);
  expect([...stored].sort()).toEqual([1, 2]);
  expect(toggle).not.toHaveBeenCalled();
  await waitFor(() => expect(client.isMutating()).toBe(0));
  expect(invalidation).toHaveBeenCalledWith({ queryKey: ['favorites', AUTH_USER.id] });
  expect(invalidation).toHaveBeenCalledWith({ queryKey: ['favorites', 'ids', AUTH_USER.id] });
});

it('espera conectividad y conserva los pendientes hasta confirmar su transferencia', async () => {
  onlineManager.setOnline(false);
  const add = jest
    .spyOn(favoriteService, 'add')
    .mockImplementation(async (id) => ({ productId: id, favorited: true, message: 'Guardado' }));
  await setup(['1']);
  await act(async () => {
    await login();
  });
  expect(add).not.toHaveBeenCalled();
  expect(controls.guest.favorites).toEqual(['1']);
  await act(() => onlineManager.setOnline(true));
  await waitFor(() => expect(controls.guest.favorites).toEqual([]));
  expect(add).toHaveBeenCalledTimes(1);
});

it('no repite un 429 en bucle y reintenta al volver a primer plano', async () => {
  const add = jest
    .spyOn(favoriteService, 'add')
    .mockRejectedValueOnce(new ApiError('Límite', { kind: 'http', status: 429 }))
    .mockResolvedValue({ productId: 1, favorited: true, message: 'Guardado' });
  const { client } = await setup(['1']);
  await act(async () => {
    await login();
  });
  await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(client.isMutating()).toBe(0));
  expect(controls.guest.favorites).toEqual(['1']);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(add).toHaveBeenCalledTimes(1);
  await act(() => focusManager.setFocused(false));
  await act(() => focusManager.setFocused(true));
  await waitFor(() => expect(controls.guest.favorites).toEqual([]));
  expect(add).toHaveBeenCalledTimes(2);
});

it('no consume pendientes ni invalida datos privados con una respuesta posterior al logout', async () => {
  let finish!: (response: Awaited<ReturnType<typeof favoriteService.add>>) => void;
  const add = jest.spyOn(favoriteService, 'add').mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { client } = await setup(['1']);
  const invalidation = jest.spyOn(client, 'invalidateQueries');
  await act(async () => {
    await login();
  });
  await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
  expect(client.isMutating({ mutationKey: ['favorites', 'toggle', AUTH_USER.id] })).toBe(1);
  await act(async () => {
    await controls.auth.logout();
  });
  await act(async () => {
    finish({ productId: 1, favorited: true, message: 'Guardado' });
  });
  expect(controls.guest.favorites).toEqual(['1']);
  expect(invalidation).not.toHaveBeenCalled();
});
