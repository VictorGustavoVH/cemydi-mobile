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
  const [state, setState] = useState({ enabled, refreshing: false });
  // Reset local UI when availability changes, without an extra effect render.
  if (state.enabled !== enabled) setState({ enabled, refreshing: false });
  const inFlight = useRef(false);
  const generation = useRef(0);
  const latest = useRef({ refresh, enabled });
  useEffect(() => {
    latest.current = { refresh, enabled };
  });
  const invalidate = useCallback(() => {
    generation.current++;
    inFlight.current = false;
  }, []);
  useEffect(() => {
    if (!enabled) invalidate();
    return invalidate;
  }, [enabled, invalidate]);

  const run = useCallback(async () => {
    const { refresh: currentRefresh, enabled: isEnabled } = latest.current;
    // Ignora gestos mientras la recarga ya está en curso o no está disponible.
    if (!isEnabled || inFlight.current) return;
    inFlight.current = true;
    const request = ++generation.current;
    setState({ enabled: isEnabled, refreshing: true });
    try {
      await currentRefresh();
    } catch {
      // La query que originó la recarga ya expone su propio estado de error.
    } finally {
      if (request === generation.current) {
        inFlight.current = false;
        setState((current) => ({ ...current, refreshing: false }));
      }
    }
  }, []);

  const onRefresh = useCallback(() => {
    void run();
  }, [run]);

  return { refreshing: state.refreshing, onRefresh };
}
