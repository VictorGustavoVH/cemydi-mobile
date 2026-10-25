import { useCallback, useEffect, useRef, useState } from 'react';

type PullToRefreshOptions = {
  /** Cuando es falso, el gesto no recarga ni muestra el indicador. */
  enabled?: boolean;
};

type PullToRefreshState = {
  /** Solo es `true` durante una recarga iniciada explícitamente por el usuario. */
  refreshing: boolean;
  onRefresh: () => void;
};

/**
 * Controla el `refreshing` de un `RefreshControl` sin mezclarlo con los refetch
 * automáticos de TanStack Query (foco, reconexión o `refetchInterval`). Solo
 * refleja la recarga que el usuario inicia con el gesto o con un reintento.
 */
export function usePullToRefresh(
  refresh: () => Promise<unknown>,
  { enabled = true }: PullToRefreshOptions = {},
): PullToRefreshState {
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);
  const latest = useRef({ refresh, enabled });
  useEffect(() => {
    latest.current = { refresh, enabled };
  });

  const run = useCallback(async () => {
    const { refresh: currentRefresh, enabled: isEnabled } = latest.current;
    // Ignora gestos mientras la recarga ya está en curso o no está disponible.
    if (!isEnabled || inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      await currentRefresh();
    } catch {
      // La query que originó la recarga ya expone su propio estado de error.
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    void run();
  }, [run]);

  return { refreshing, onRefresh };
}
