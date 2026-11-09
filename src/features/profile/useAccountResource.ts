import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

// Conserva el último recurso al navegar para mostrarlo mientras se actualiza o
// cuando no hay conexión. AuthProvider limpia la caché al cambiar de cuenta.
const ACCOUNT_GC_TIME_MS = 5 * 60_000;

export function useAccountResource<T>(
  key: readonly unknown[],
  load: (signal: AbortSignal) => Promise<T>,
  {
    clientOnly = false,
    enabled = true,
    publicAccess = false,
    keepPreviousData: keepPrevious = false,
    autoRefresh = false,
  } = {},
) {
  const { user, status } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [focused, setFocused] = useState(false);
  const allowed =
    publicAccess ||
    (status === 'authenticated' && Boolean(user) && (!clientOnly || user?.rol === 'CLIENT'));
  const query = useQuery({
    queryKey: ['account', publicAccess ? 'public' : user?.id, ...key],
    queryFn: ({ signal }) => load(signal),
    enabled: allowed && enabled,
    gcTime: ACCOUNT_GC_TIME_MS,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: 'always',
    refetchInterval: autoRefresh && focused && isOnline !== false ? 30_000 : false,
    refetchIntervalInBackground: false,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  });
  const latestQuery = useRef(query);
  useEffect(() => {
    latestQuery.current = query;
  }, [query]);
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      if (
        autoRefresh &&
        allowed &&
        enabled &&
        isOnline !== false &&
        latestQuery.current.data !== undefined &&
        !latestQuery.current.isFetching
      )
        void refetch();
      return () => setFocused(false);
    }, [autoRefresh, allowed, enabled, isOnline, refetch]),
  );
  return { query, isOnline, allowed };
}
