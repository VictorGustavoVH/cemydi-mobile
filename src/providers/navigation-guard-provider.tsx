import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react';

export const DEFAULT_NAVIGATION_INTERVAL_MS = 800;

type NavigationLock = { startedAt: number; intervalMs: number } | null;
type NavigationGuard = (navigate: () => void, intervalMs?: number) => boolean;

const NavigationGuardContext = createContext<NavigationGuard | null>(null);

export function NavigationGuardProvider({
  children,
  intervalMs = DEFAULT_NAVIGATION_INTERVAL_MS,
}: {
  children: ReactNode;
  intervalMs?: number;
}) {
  const run = useNavigationLock(intervalMs);
  return <NavigationGuardContext.Provider value={run}>{children}</NavigationGuardContext.Provider>;
}

function useNavigationLock(defaultIntervalMs: number): NavigationGuard {
  const lock = useRef<NavigationLock>(null);
  return useCallback(
    (navigate, intervalMs = defaultIntervalMs) => {
      const now = Date.now();
      const previous = lock.current;
      if (previous && now - previous.startedAt < previous.intervalMs) return false;
      const acquired = { startedAt: now, intervalMs: Math.max(0, intervalMs) };
      lock.current = acquired;
      try {
        navigate();
        return true;
      } catch (error) {
        if (lock.current === acquired) lock.current = null;
        throw error;
      }
    },
    [defaultIntervalMs],
  );
}

/** Shared by router consumers; the fallback isolates standalone screens and tests. */
export function useNavigationGuard(intervalMs?: number) {
  const shared = useContext(NavigationGuardContext);
  const local = useNavigationLock(DEFAULT_NAVIGATION_INTERVAL_MS);
  const run = shared ?? local;
  return useCallback((navigate: () => void) => run(navigate, intervalMs), [run, intervalMs]);
}
