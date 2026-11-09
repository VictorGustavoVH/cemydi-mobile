import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  focusManager,
  onlineManager,
  useIsMutating,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { useCatalogPreview } from '@/providers/catalog-preview-provider';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/services/http/api-error';
import { transferGuestFavorites } from './services/guest-favorites-transfer';

const subscribeOnline = (notify: () => void) => onlineManager.subscribe(notify);
const subscribeFocus = (notify: () => void) => focusManager.subscribe(notify);
const getOnline = () => onlineManager.isOnline();
const getFocused = () => focusManager.isFocused();
type Transfer = Parameters<typeof transferGuestFavorites>[1] & { ids: string[]; owner: number };

/** One owner in the root layout; individual favorite buttons must not start duplicate transfers. */
export function FavoritesLifecycle() {
  const { user, status, getSession, getSessionVersion } = useAuth();
  const { favorites, removeFavorite } = useCatalogPreview();
  const toast = useToast();
  const client = useQueryClient();
  const online = useSyncExternalStore(subscribeOnline, getOnline, getOnline);
  const focused = useSyncExternalStore(subscribeFocus, getFocused, getFocused);
  const owner = status === 'authenticated' ? user?.id : undefined;
  const version = getSessionVersion();
  const scope = `${owner}:${version}`;
  const mutationKey = useMemo(() => ['favorites', 'toggle', owner ?? 0] as const, [owner]);
  const pendingWrites = useIsMutating({ mutationKey });
  const running = useRef(false);
  const mounted = useRef(true);
  const attempted = useRef({ scope, ids: new Set<string>() });
  const [revision, wake] = useState(0);
  const { mutateAsync } = useMutation({
    mutationKey,
    retry: false,
    gcTime: 0,
    mutationFn: (input: Transfer) => transferGuestFavorites(input.ids, input),
    onMutate: async (input: Transfer) => {
      await client.cancelQueries({ queryKey: ['favorites', input.owner] });
      await client.cancelQueries({ queryKey: ['favorites', 'ids', input.owner] });
      if (!input.isCurrent()) throw new ApiError('La sesión cambió.', { kind: 'abort' });
    },
    onSettled: async (_result, _error, input) => {
      if (input.isCurrent())
        await Promise.all([
          client.invalidateQueries({ queryKey: ['favorites', input.owner] }),
          client.invalidateQueries({ queryKey: ['favorites', 'ids', input.owner] }),
        ]);
    },
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (attempted.current.scope !== scope || !online || !focused)
      attempted.current = { scope, ids: new Set() };
    if (owner === undefined || !online || !focused || running.current || pendingWrites > 0) return;
    const ids = favorites.filter((id) => !attempted.current.ids.has(id));
    if (ids.length === 0) return;
    ids.forEach((id) => attempted.current.ids.add(id));
    running.current = true;
    const isCurrent = () =>
      mounted.current && getSession().user?.id === owner && getSessionVersion() === version;
    void mutateAsync({
      ids,
      owner,
      isCurrent,
      canContinue: () => onlineManager.isOnline() && focusManager.isFocused(),
      onSaved: removeFavorite,
    })
      .then((result) => {
        if (!isCurrent()) return;
        if (result.remaining > 0)
          toast.info(
            'Algunos favoritos siguen pendientes. Los conservamos durante esta sesión y reintentaremos al recuperar conexión o volver a la app.',
          );
        else if (result.saved > 0) toast.info('Guardamos tus favoritos de invitado en tu cuenta.');
      })
      .catch(() => {
        if (isCurrent())
          toast.error(
            'No pudimos guardar tus favoritos de invitado. Conservamos los pendientes durante esta sesión.',
          );
      })
      .finally(() => {
        running.current = false;
        if (mounted.current) wake((value) => value + 1);
      });
  }, [
    scope,
    owner,
    version,
    online,
    focused,
    favorites,
    pendingWrites,
    revision,
    getSession,
    getSessionVersion,
    removeFavorite,
    mutateAsync,
    toast,
  ]);
  return null;
}
