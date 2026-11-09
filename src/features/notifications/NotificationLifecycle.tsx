import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { loadNativeNotifications, notificationIdFromData, registerNativePush } from './native-push';

export const NOTIFICATION_REFRESH_WINDOW_MS = 1500;

export function NotificationLifecycle() {
  const { user, status, getSession, getSessionVersion } = useAuth();
  const router = useRouter();
  const client = useQueryClient();
  const lastOpened = useRef<string | null>(null);
  useEffect(() => {
    if (status === 'loading' || status === 'error') return;
    let active = true;
    const version = getSessionVersion();
    const isCurrent = () =>
      active && getSessionVersion() === version && getSession().user?.id === user?.id;
    const subscriptions: { remove: () => void }[] = [];
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let clearHandler: (() => void) | undefined;
    const refresh = () => {
      if (user?.rol === 'CLIENT')
        void registerNativePush(isCurrent, false, user.id).catch(() => undefined);
    };
    void loadNativeNotifications()
      .then(async (notifications) => {
        if (!active) return;
        notifications.setNotificationHandler({
          handleNotification: async (notification) => {
            const current = getSession();
            const allowed =
              isCurrent() &&
              current.user?.rol === 'CLIENT' &&
              notification.request.content.data?.userId === current.user.id;
            return {
              shouldShowBanner: allowed,
              shouldShowList: allowed,
              shouldPlaySound: allowed,
              shouldSetBadge: false,
            };
          },
        });
        clearHandler = () => notifications.setNotificationHandler(null);
        const open = (response: import('expo-notifications').NotificationResponse) => {
          const id = notificationIdFromData(response.notification.request.content.data);
          if (!id || !isCurrent()) return;
          const current = getSession();
          const targetUser = response.notification.request.content.data?.userId;
          if (current.user && targetUser !== current.user.id) return;
          const responseKey = `${response.notification.request.identifier}:${response.actionIdentifier}`;
          if (lastOpened.current === responseKey) return;
          lastOpened.current = responseKey;
          if (current.user?.rol === 'CLIENT')
            router.push({ pathname: '/perfil/notificaciones/[id]', params: { id } });
          else if (!current.user) {
            router.push('/login');
          }
          void notifications.clearLastNotificationResponseAsync().catch(() => undefined);
        };
        subscriptions.push(notifications.addNotificationResponseReceivedListener(open));
        subscriptions.push(
          notifications.addNotificationReceivedListener((notification) => {
            if (
              isCurrent() &&
              user?.rol === 'CLIENT' &&
              notification.request.content.data?.userId === user.id
            ) {
              if (refreshTimer !== undefined) return;
              // One trailing refresh per window; a continuous stream cannot postpone it forever.
              refreshTimer = setTimeout(() => {
                refreshTimer = undefined;
                if (!isCurrent()) return;
                void client.invalidateQueries({ queryKey: ['notifications', user.id] });
                void client.invalidateQueries({ queryKey: ['account', user.id] });
                void client.invalidateQueries({ queryKey: ['reviews', 'product'] });
              }, NOTIFICATION_REFRESH_WINDOW_MS);
            }
          }),
        );
        subscriptions.push(notifications.addPushTokenListener(refresh));
        const response = await notifications.getLastNotificationResponseAsync();
        if (active && response) open(response);
        if (active) refresh();
      })
      .catch(() => {
        /* Inbox and preferences remain usable without a native push module. */
      });
    subscriptions.push(
      AppState.addEventListener('change', (value) => {
        if (value === 'active') refresh();
      }),
    );
    return () => {
      active = false;
      if (refreshTimer !== undefined) clearTimeout(refreshTimer);
      clearHandler?.();
      subscriptions.forEach((item) => item.remove());
    };
  }, [user?.id, user?.rol, status, getSession, getSessionVersion, router, client]);
  return null;
}
