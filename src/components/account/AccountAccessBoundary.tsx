import { useCallback, useRef, type ReactNode } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { LogoutStorageError } from '@/features/auth';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/hooks/useToast';

type AccountAccessBoundaryProps = { children: ReactNode; publicAccess?: boolean };

/** Conserva la política de acceso de cuenta sin imponer encabezado o navegación de Perfil. */
export function AccountAccessBoundary({
  children,
  publicAccess = false,
}: AccountAccessBoundaryProps) {
  const { status, user, error, retrySession, logoutDetailed, consumeExplicitLogout } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const redirecting = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (publicAccess || status === 'loading' || status === 'error') return;
      if (status === 'authenticated' && user) {
        redirecting.current = false;
        return;
      }
      if (redirecting.current) return;
      redirecting.current = true;
      if (!consumeExplicitLogout?.()) {
        toast.info('Inicia sesión para continuar');
        router.navigate('/inicio');
      }
      return () => {
        redirecting.current = false;
      };
    }, [publicAccess, status, user, consumeExplicitLogout, router, toast]),
  );
  if (publicAccess) return children;
  if (status === 'loading') return <LoadingState label="Comprobando tu sesión…" />;
  if (status === 'error')
    return error instanceof LogoutStorageError ? (
      <ErrorState
        title="No pudimos confirmar el cierre de sesión"
        onRetry={() =>
          void logoutDetailed()
            .then(() => router.navigate('/inicio'))
            .catch(() => undefined)
        }
      />
    ) : (
      <ErrorState title="No pudimos comprobar tu sesión" onRetry={() => void retrySession()} />
    );
  if (!user || status !== 'authenticated') return null;
  return children;
}
