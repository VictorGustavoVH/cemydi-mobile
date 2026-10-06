import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

/**
 * Estado simple de conectividad para componentes.
 *
 * Nota: QueryProvider ya integra expo-network con TanStack Query
 * (onlineManager). Este hook es para pantallas/componentes que necesiten
 * conocer la conectividad directamente; aún no se consume en ninguna
 * pantalla.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    void Network.getNetworkStateAsync()
      .then((state) => {
        if (mounted) {
          setIsOnline(state.isInternetReachable ?? state.isConnected ?? true);
        }
      })
      .catch(() => {
        if (mounted) setIsOnline(true);
      });

    const subscription = Network.addNetworkStateListener((state) => {
      setIsOnline(state.isInternetReachable ?? state.isConnected ?? true);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return { isOnline };
}
