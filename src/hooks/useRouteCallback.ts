import { useCallback, useEffect, useRef } from 'react';

export function useRouteCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  routeKey: (...args: Args) => string,
  intervalMs = 800,
): (...args: Args) => void {
  const recentRoutes = useRef(new Map<string, number>());
  const current = useRef({ callback, routeKey });
  useEffect(() => {
    current.current = { callback, routeKey };
  });
  return useCallback(
    (...args: Args) => {
      const now = Date.now();
      const key = current.current.routeKey(...args);
      const previous = recentRoutes.current.get(key);
      if (previous !== undefined && now - previous < intervalMs) return;
      for (const [route, time] of recentRoutes.current) {
        if (now - time >= intervalMs) recentRoutes.current.delete(route);
      }
      recentRoutes.current.set(key, now);
      current.current.callback(...args);
    },
    [intervalMs],
  );
}
