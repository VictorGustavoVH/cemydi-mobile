import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { loadNativeNotifications, notificationIdFromData, registerNativePush } from './native-push';

export function NotificationLifecycle() {
  const { user, status, getSession, getSessionVersion, setAuthDestination } = useAuth();
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
    let clearHandler: (() => void) | undefined;
    const refresh = () => {
      if (user?.rol === 'CLIENT') void registerNativePush(isCurrent, false).catch(() => undefined);
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
            setAuthDestination(`/perfil/notificaciones/${id}`);
            router.push('/login');
          }
          void notifications.clearLastNotificationResponseAsync().catch(() => undefined);
        };
        subscriptions.push(notifications.addNotificationResponseReceivedListener(open));
        subscriptions.push(
          notifications.addNotificationReceivedListener(() => {
            if (isCurrent() && user?.rol === 'CLIENT')
              void client.invalidateQueries({ queryKey: ['notifications', user.id] });
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
      clearHandler?.();
      subscriptions.forEach((item) => item.remove());
    };
  }, [
    user?.id,
    user?.rol,
    status,
    getSession,
    getSessionVersion,
    setAuthDestination,
    router,
    client,
  ]);
  return null;
}
