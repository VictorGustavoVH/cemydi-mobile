import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LoadingState } from '@/components/ui/LoadingState';
import { ProfileLayout } from '@/features/profile/components/ProfileLayout';
import { AccountResourceState } from '@/features/profile/components/AccountResourceState';
import { useAuth } from '@/providers/auth-provider';
import { notificationService } from './notification-service';
import { notificationDestination } from './notification-destination';
import { useNotificationActions } from './useNotifications';

export function NotificationRedirectScreen({ id }: { id: string }) {
  const { user } = useAuth();
  return (
    <ProfileLayout title="Notificaciones">
      <NotificationRedirect key={`${user?.id}:${id}`} id={id} />
    </ProfileLayout>
  );
}

function NotificationRedirect({ id }: { id: string }) {
  const router = useRouter();
  const { user, status } = useAuth();
  const allowed = status === 'authenticated' && user?.rol === 'CLIENT';
  const actions = useNotificationActions();
  const opened = useRef(false);
  const query = useQuery({
    queryKey: ['notifications', user?.id, 'destination', id],
    queryFn: ({ signal }) => notificationService.detail(id, signal),
    enabled: allowed && !!id,
    gcTime: 0,
  });
  const item = query.data?.item;
  const { run } = actions;
  useEffect(() => {
    if (!allowed || !item || opened.current) return;
    opened.current = true;
    if (!item.readAt) void run(() => notificationService.read([item.id])).catch(() => undefined);
    router.replace(notificationDestination(item) ?? '/perfil/notificaciones');
  }, [allowed, item, router, run]);
  return (
    <AccountResourceState
      data={query.data}
      error={query.error}
      isError={query.isError}
      isOnline={actions.isOnline}
      allowed={allowed}
      retry={() => void query.refetch()}
    >
      <LoadingState label="Abriendo destino…" />
    </AccountResourceState>
  );
}
