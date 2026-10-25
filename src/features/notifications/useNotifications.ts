import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { UserFacingError } from '@/services/http/api-error';
import { notificationService } from './notification-service';
import type { NotificationInbox } from './notification-schemas';

export function useNotifications(page = 1, category?: string, suspendPolling = false) {
  const { user, status } = useAuth();
  const { isOnline } = useNetworkStatus();
  const allowed = status === 'authenticated' && user?.rol === 'CLIENT';
  const query = useQuery({
    queryKey: ['notifications', user?.id, 'inbox', page, category],
    queryFn: ({ signal }) => notificationService.inbox(page, category, signal),
    enabled: allowed && !suspendPolling,
    refetchInterval: suspendPolling ? false : 30000,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === user?.id ? previous : undefined,
    gcTime: 0,
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (allowed && !suspendPolling) void refetch();
    }, [allowed, suspendPolling, refetch]),
  );
  return { query, isOnline, allowed };
}

export function useInfiniteNotifications(category?: string, suspendPolling = false) {
  const { user, status } = useAuth();
  const { isOnline } = useNetworkStatus();
  const allowed = status === 'authenticated' && user?.rol === 'CLIENT';
  const query = useInfiniteQuery({
    queryKey: ['notifications', user?.id, 'inbox', 'infinite', category],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => notificationService.inbox(pageParam, category, signal),
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    enabled: allowed && !suspendPolling,
    refetchInterval: suspendPolling ? false : 30000,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === user?.id ? previous : undefined,
    gcTime: 0,
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (allowed && !suspendPolling) void refetch();
    }, [allowed, suspendPolling, refetch]),
  );
  return { query, isOnline, allowed };
}

type InboxCache = NotificationInbox | InfiniteData<NotificationInbox>;
const inboxPages = (cache: InboxCache | undefined) =>
  !cache ? [] : 'pages' in cache ? cache.pages : [cache];

export function useNotificationActions() {
  const { user, getSession, getSessionVersion } = useAuth();
  const client = useQueryClient();
  const { isOnline } = useNetworkStatus();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T>(action: (isCurrent: () => boolean) => Promise<T>) => {
      if (lock.current) throw new UserFacingError('Espera a que termine la operación.');
      if (!user || user.rol !== 'CLIENT')
        throw new UserFacingError('Inicia sesión con tu cuenta de cliente.');
      if (isOnline === false)
        throw new UserFacingError('Conéctate a internet para guardar los cambios.');
      const version = getSessionVersion();
      const id = user.id;
      const isCurrent = () => getSessionVersion() === version && getSession().user?.id === id;
      lock.current = true;
      setBusy(true);
      try {
        await client.cancelQueries({ queryKey: ['notifications', id] });
        if (!isCurrent())
          throw new UserFacingError('La sesión cambió. Vuelve a abrir las notificaciones.');
        const result = await action(isCurrent);
        if (!isCurrent())
          throw new UserFacingError('La sesión cambió. Vuelve a abrir las notificaciones.');
        await client.invalidateQueries({ queryKey: ['notifications', id] });
        return result;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [user, isOnline, getSessionVersion, getSession, client],
  );
  return { run, busy, isOnline };
}

export function useNotificationReadActions() {
  const { user } = useAuth();
  const client = useQueryClient();
  const actions = useNotificationActions();
  const { run } = actions;
  const read = useCallback(
    (ids?: string[]) =>
      run(async (isCurrent) => {
        const key = ['notifications', user?.id, 'inbox'] as const;
        const snapshots = client.getQueriesData<InboxCache>({ queryKey: key });
        const targets = ids ? new Set(ids) : null;
        const pending = new Set(
          snapshots.flatMap(([, inbox]) =>
            inboxPages(inbox)
              .flatMap((page) => page.items)
              .filter((item) => !item.readAt && (!targets || targets.has(item.id)))
              .map((item) => item.id),
          ),
        );
        const now = new Date().toISOString();
        const update = (inbox: NotificationInbox): NotificationInbox => ({
          ...inbox,
          unreadCount: targets ? Math.max(0, inbox.unreadCount - pending.size) : 0,
          items: inbox.items.map((item) =>
            !item.readAt && (!targets || targets.has(item.id)) ? { ...item, readAt: now } : item,
          ),
        });
        client.setQueriesData<InboxCache>({ queryKey: key }, (cache) =>
          !cache
            ? cache
            : 'pages' in cache
              ? { ...cache, pages: cache.pages.map(update) }
              : update(cache),
        );
        try {
          return await (ids ? notificationService.read(ids) : notificationService.readAll());
        } catch (error) {
          if (isCurrent())
            for (const [queryKey, snapshot] of snapshots) {
              if (snapshot) client.setQueryData(queryKey, snapshot);
            }
          throw error;
        }
      }),
    [client, run, user?.id],
  );
  return { ...actions, read };
}
