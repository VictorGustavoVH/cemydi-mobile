import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

/**
 * Estado simple de conectividad para componentes.
 *
 * Nota: QueryProvider ya integra expo-network con TanStack Query
 * (onlineManager). Este hook es para pantallas/componentes que necesiten
 * conocer la conectividad directamente (ej. HomeScreen, que lo usa para
 * priorizar OfflineState cuando no hay datos).
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    let receivedEvent = false;

    void Network.getNetworkStateAsync()
      .then((state) => {
        if (mounted && !receivedEvent) {
          setIsOnline(state.isInternetReachable ?? state.isConnected ?? true);
        }
      })
      .catch(() => {
        if (mounted && !receivedEvent) setIsOnline(true);
      });

    const subscription = Network.addNetworkStateListener((state) => {
      receivedEvent = true;
      if (mounted) setIsOnline(state.isInternetReachable ?? state.isConnected ?? true);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return { isOnline };
}
