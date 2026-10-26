import { useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { registerNativePush } from './native-push';

export function useNotificationPermissionAccess() {
  const { user, status, getSession, getSessionVersion } = useAuth();
  return useCallback(() => {
    if (status !== 'authenticated' || user?.rol !== 'CLIENT') return;
    const version = getSessionVersion(),
      id = user.id;
    void registerNativePush(
      () => getSessionVersion() === version && getSession().user?.id === id,
      true,
    ).catch(() => undefined);
  }, [user, status, getSession, getSessionVersion]);
}
