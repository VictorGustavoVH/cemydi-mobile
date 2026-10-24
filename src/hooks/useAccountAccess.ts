import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import type { AuthDestination } from '@/features/auth/auth-destination';
import { useToast } from './useToast';

export type RequestAccessOptions = {
  showToast?: boolean;
};

export function useAccountAccess() {
  const router = useRouter();
  const toast = useToast();
  const { user, status, retrySession, setAuthDestination } = useAuth();
  const requestAccess = useCallback(
    (destination: AuthDestination, options?: RequestAccessOptions) => {
      if (user) return true;
      if (status === 'loading') {
        toast.info('Estamos comprobando tu sesión');
        return false;
      }
      if (status === 'error') {
        toast.error('No pudimos comprobar tu sesión. Comprueba tu conexión e intenta de nuevo.');
        void retrySession();
        return false;
      }
      setAuthDestination(destination);
      const shouldShowToast = options?.showToast ?? destination !== '/perfil';
      if (shouldShowToast) {
        toast.info('Inicia sesión para continuar');
      }
      router.push('/login');
      return false;
    },
    [user, status, retrySession, setAuthDestination, toast, router],
  );
  return { user, requestAccess };
}
