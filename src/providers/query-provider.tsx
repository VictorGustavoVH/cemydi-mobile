import { type ReactNode, useEffect, useState } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import * as Network from 'expo-network';

import { isRetryableApiError } from '@/services/http/api-error';

const QUERY_STALE_TIME_MS = 30_000;
const QUERY_GC_TIME_MS = 5 * 60_000;
const MAX_QUERY_RETRIES = 2;

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        gcTime: QUERY_GC_TIME_MS,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) =>
          failureCount < MAX_QUERY_RETRIES && isRetryableApiError(error),
        staleTime: QUERY_STALE_TIME_MS,
      },
    },
  });
}

function getOnlineState(state: Network.NetworkState): boolean {
  return state.isInternetReachable ?? state.isConnected ?? true;
}

function configureOnlineManager(): void {
  onlineManager.setEventListener((setOnline) => {
    let initialized = false;
    const subscription = Network.addNetworkStateListener((state) => {
      initialized = true;
      setOnline(getOnlineState(state));
    });

    void Network.getNetworkStateAsync()
      .then((state) => {
        if (!initialized) {
          setOnline(getOnlineState(state));
        }
      })
      .catch(() => {
        // Un estado desconocido no debe marcar al dispositivo como offline.
      });

    return () => subscription.remove();
  });
}

function onAppStateChange(status: AppStateStatus): void {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

type QueryProviderProps = {
  children: ReactNode;
};

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(createQueryClient);

  useEffect(() => {
    configureOnlineManager();
    onAppStateChange(AppState.currentState);

    const appStateSubscription = AppState.addEventListener('change', onAppStateChange);

    return () => {
      appStateSubscription.remove();
      onlineManager.setEventListener(() => undefined);
    };
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
