import { useMemo } from 'react';
import { useRouter, type ImperativeRouter } from 'expo-router';
import { useNavigationGuard } from '@/providers/navigation-guard-provider';

/** User initiated forward navigation. Automatic redirects keep the original router. */
export function useSafeNavigation(intervalMs?: number): ImperativeRouter {
  const router = useRouter();
  const run = useNavigationGuard(intervalMs);
  return useMemo(
    () => ({
      ...router,
      push: (...args: Parameters<ImperativeRouter['push']>) => {
        run(() => router.push(...args));
      },
      navigate: (...args: Parameters<ImperativeRouter['navigate']>) => {
        run(() => router.navigate(...args));
      },
    }),
    [router, run],
  );
}
