import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function useAccountResource<T>(
  key: readonly unknown[],
  load: (signal: AbortSignal) => Promise<T>,
  { clientOnly = false, enabled = true, publicAccess = false } = {},
) {
  const { user, status } = useAuth();
  const { isOnline } = useNetworkStatus();
  const allowed =
    publicAccess ||
    (status === 'authenticated' && Boolean(user) && (!clientOnly || user?.rol === 'CLIENT'));
  const query = useQuery({
    queryKey: ['account', publicAccess ? 'public' : user?.id, ...key],
    queryFn: ({ signal }) => load(signal),
    enabled: allowed && enabled,
    gcTime: 0,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: 'always',
  });
  return { query, isOnline, allowed };
}
