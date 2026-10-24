import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { onlineManager, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth-provider';
import {
  useCatalogPreview,
  useCatalogPreviewActions,
  useOptionalCatalogPreview,
  type PreviewCartItem,
  type RentalDraft,
} from './catalog-preview-provider';
import { cartService, type ServerCart } from '@/features/cart/services/cart-service';
import { toCartEntry } from '@/features/cart/services/cart-adapter';
import { getCartEntries } from '@/features/cart/cart-preview';
import { isApiError, UserFacingError } from '@/services/http/api-error';
import { createCartTransfer } from '@/features/cart/services/cart-transfer';

export const cartQueryKey = (userId: number | undefined) => ['cart', userId] as const;
const subscribeOnline = (notify: () => void) => onlineManager.subscribe(notify);
const getOnline = () => onlineManager.isOnline();
export const CART_SYNC_INTERVAL_MS = 10_000;
function useRemoteCart() {
  const { user, status, getSession, getSessionVersion } = useAuth();
  const userId = status === 'authenticated' ? user?.id : undefined;
  const client = useQueryClient();
  const online = useSyncExternalStore(subscribeOnline, getOnline, getOnline);
  const [busy, setBusy] = useState(false);
  const [uncertainty, setUncertainty] = useState<{ owner: number } | null>(null);
  const [selection, setSelection] = useState<{ owner?: number; values: Record<number, boolean> }>({
    values: {},
  });
  const lock = useRef(false);
  const owner = useRef(userId);

  const query = useQuery({
    queryKey: cartQueryKey(userId),
    queryFn: ({ signal }) => cartService.get(signal),
    enabled: userId !== undefined && !busy,
    staleTime: 30_000,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    refetchInterval: CART_SYNC_INTERVAL_MS,
    refetchIntervalInBackground: false,
    retry: false,
    gcTime: 0,
  });
  const { mutateAsync } = useMutation({
    mutationFn: (operation: () => Promise<ServerCart>) => operation(),
    retry: false,
    networkMode: 'always',
    gcTime: 0,
  });
  const uncertain = uncertainty !== null && uncertainty.owner === userId;
  const latest = useRef({ userId, online, uncertain, data: query.data });
  useLayoutEffect(() => {
    owner.current = userId;
    latest.current = { userId, online, uncertain, data: query.data };
  }, [userId, online, uncertain, query.data]);
  const run = useCallback(
    async (operation: () => Promise<ServerCart>) => {
      const { userId: expected, online, uncertain } = latest.current;
      const version = getSessionVersion();
      if (expected === undefined)
        throw new UserFacingError('Inicia sesión para guardar el carrito.');
      if (lock.current)
        throw new UserFacingError('Espera a que termine la actualización del carrito.');
      if (!online)
        throw new UserFacingError(
          'Sin conexión. Vuelve a conectarte antes de modificar el carrito.',
        );
      if (uncertain)
        throw new UserFacingError(
          'Actualiza el carrito para comprobar el resultado antes de repetir la operación.',
        );
      lock.current = true;
      setBusy(true);
      try {
        await client.cancelQueries({ queryKey: cartQueryKey(expected) });
        if (getSession().user?.id !== expected || getSessionVersion() !== version)
          throw new UserFacingError('La sesión cambió.');
        const result = await mutateAsync(operation);
        if (
          owner.current !== expected ||
          getSession().user?.id !== expected ||
          getSessionVersion() !== version
        )
          throw new UserFacingError('La sesión cambió. Revisa el carrito de tu cuenta.');
        client.setQueryData(cartQueryKey(expected), result);
        setUncertainty(null);
        return result;
      } catch (error) {
        if (owner.current === expected)
          void client.invalidateQueries({ queryKey: cartQueryKey(expected), refetchType: 'none' });
        if (
          owner.current === expected &&
          isApiError(error) &&
          (['network', 'timeout', 'parse'].includes(error.kind) ||
            (error.status !== undefined && error.status >= 500))
        )
          setUncertainty({ owner: expected });
        throw error;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [client, mutateAsync, getSession, getSessionVersion],
  );
  const transfer = useMemo(() => ({ owner: userId, service: createCartTransfer() }), [userId]);
  const actions = useMemo(() => {
    const find = (productId: string, mode: PreviewCartItem['mode'], serverId?: number) => {
      const item = latest.current.data?.items.find((item) =>
        serverId !== undefined
          ? item.id === serverId
          : String(item.product.id) === productId &&
            item.mode === (mode === 'rental' ? 'RENTA' : 'VENTA'),
      );
      if (!item) throw new UserFacingError('Actualiza el carrito para encontrar este producto.');
      return item;
    };
    return {
      async addItem(productId: string, mode: PreviewCartItem['mode']) {
        if (!/^\d+$/.test(productId))
          throw new UserFacingError('Este producto de muestra no se puede guardar en tu cuenta.');
        await run(() =>
          cartService.add({
            productId: Number(productId),
            mode: mode === 'rental' ? 'RENTA' : 'VENTA',
            quantity: 1,
          }),
        );
      },
      async removeItem(productId: string, mode: PreviewCartItem['mode'], serverId?: number) {
        const item = find(productId, mode, serverId);
        await run(() => cartService.remove(item.id));
      },
      async updateQuantity(
        productId: string,
        mode: PreviewCartItem['mode'],
        quantity: number,
        serverId?: number,
      ) {
        const item = find(productId, mode, serverId);
        await run(() => cartService.update(item.id, { quantity }));
      },
      async saveRentalDraft(productId: string, draft: RentalDraft, serverId?: number) {
        const item = find(productId, 'rental', serverId);
        await run(() =>
          cartService.update(item.id, {
            quantity: item.quantity,
            rentalStartDate: draft.startDate,
            rentalEndDate: draft.endDate,
            rentalNotes: draft.notes,
          }),
        );
      },
      async restoreItem(item: PreviewCartItem, _index: number) {
        await run(() =>
          cartService.add({
            productId: Number(item.productId),
            mode: item.mode === 'rental' ? 'RENTA' : 'VENTA',
            quantity: item.quantity,
            ...(item.rentalDraft
              ? {
                  rentalStartDate: item.rentalDraft.startDate,
                  rentalEndDate: item.rentalDraft.endDate,
                  rentalNotes: item.rentalDraft.notes,
                }
              : {}),
          }),
        );
      },
      toggleSelection(_productId: string, _mode: PreviewCartItem['mode'], serverId?: number) {
        if (serverId === undefined) return;
        setSelection((current) => ({
          owner: latest.current.userId,
          values: {
            ...(current.owner === latest.current.userId ? current.values : {}),
            [serverId]: !(current.owner === latest.current.userId
              ? (current.values[serverId] ?? true)
              : true),
          },
        }));
      },
      selectMode(mode: PreviewCartItem['mode'], selected: boolean) {
        setSelection((current) => ({
          owner: latest.current.userId,
          values: {
            ...(current.owner === latest.current.userId ? current.values : {}),
            ...Object.fromEntries(
              (latest.current.data?.items ?? [])
                .filter((item) => item.mode === (mode === 'rental' ? 'RENTA' : 'VENTA'))
                .map((item) => [item.id, selected]),
            ),
          },
        }));
      },
    };
  }, [run]);
  const entries = useMemo(
    () =>
      (query.data?.items ?? []).map((item) => {
        const entry = toCartEntry(item);
        return selection.owner === userId && selection.values[item.id] === false
          ? { ...entry, item: { ...entry.item, selected: false } }
          : entry;
      }),
    [query.data, selection, userId],
  );
  const isCurrent = useCallback(
    (id: number | undefined, version?: number) =>
      id !== undefined &&
      getSession().user?.id === id &&
      (version === undefined || getSessionVersion() === version),
    [getSession, getSessionVersion],
  );
  const { refetch } = query;
  const refreshCart = useCallback(async () => {
    if (lock.current) return;
    const result = await refetch();
    if (result.isSuccess) setUncertainty(null);
    return result;
  }, [refetch]);
  const cartQuery = useMemo(
    () => ({
      data: query.data,
      error: query.error,
      isError: query.isError,
      isFetching: query.isFetching,
      refetch: query.refetch,
    }),
    [query.data, query.error, query.isError, query.isFetching, query.refetch],
  );
  return useMemo(
    () => ({
      userId,
      status,
      online,
      busy,
      uncertain,
      run,
      actions,
      entries,
      cart: query.data,
      query: cartQuery,
      transfer: transfer.service,
      refreshCart,
      isCurrent,
      authVersion: getSessionVersion,
    }),
    [
      userId,
      status,
      online,
      busy,
      uncertain,
      run,
      actions,
      entries,
      query.data,
      cartQuery,
      transfer.service,
      refreshCart,
      isCurrent,
      getSessionVersion,
    ],
  );
}
const CartContext = createContext<ReturnType<typeof useRemoteCart> | null>(null);
const CartActionsContext = createContext<ReturnType<typeof useRemoteCart>['actions'] | null>(null);
/** Solo el número de unidades: aísla a la barra inferior del sondeo del carrito. */
const CartCountContext = createContext(0);
export function CartProvider({ children }: { children: ReactNode }) {
  const value = useRemoteCart();
  const guest = useOptionalCatalogPreview();
  const connected = value.userId !== undefined;
  const guestItems = guest?.items;
  const count = useMemo(
    () =>
      connected
        ? value.entries.reduce((sum, entry) => sum + entry.item.quantity, 0)
        : (guestItems ?? []).reduce((sum, item) => sum + item.quantity, 0),
    [connected, value.entries, guestItems],
  );
  return (
    <CartCountContext.Provider value={count}>
      <CartActionsContext.Provider value={value.actions}>
        <CartContext.Provider value={value}>{children}</CartContext.Provider>
      </CartActionsContext.Provider>
    </CartCountContext.Provider>
  );
}
export function useCartCount() {
  return useContext(CartCountContext);
}
export function useCartActions() {
  const { user, status } = useAuth();
  const remote = useContext(CartActionsContext);
  const guest = useCatalogPreviewActions();
  if (user && status === 'authenticated') {
    if (!remote) throw new Error('CartProvider is required.');
    return remote;
  }
  return guest;
}
export function useCart() {
  const remote = useContext(CartContext);
  const guest = useCatalogPreview();
  const actions = useCartActions();
  if (!remote) throw new Error('CartProvider is required.');
  const connected = remote.userId !== undefined;
  const entries = useMemo(
    () => (connected ? remote.entries : getCartEntries(guest.items)),
    [connected, remote.entries, guest.items],
  );
  const items = useMemo(
    () => (connected ? entries.map((entry) => entry.item) : guest.items),
    [connected, entries, guest.items],
  );
  const discardGuestItems = useCallback(() => {
    for (const item of guest.items) guest.removeItem(item.productId, item.mode);
  }, [guest]);
  const saveGuestItems = useCallback(async () => {
    const expected = remote.userId;
    const version = remote.authVersion();
    await remote.run(() =>
      remote.transfer.save(
        guest.items,
        () => remote.isCurrent(expected, version),
        (item) => guest.removeItem(item.productId, item.mode),
      ),
    );
  }, [guest, remote]);
  return useMemo(
    () => ({
      ...remote,
      ...actions,
      connected,
      entries,
      items,
      guestItems: guest.items,
      discardGuestItems,
      saveGuestItems,
    }),
    [remote, actions, connected, entries, items, guest.items, discardGuestItems, saveGuestItems],
  );
}
