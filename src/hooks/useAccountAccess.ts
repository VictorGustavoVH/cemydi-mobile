import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useAuthPreview } from '@/providers/auth-preview-provider';
import { useToast } from './useToast';

export function useAccountAccess() {
  const router = useRouter();
  const toast = useToast();
  const { user, setAuthDestination } = useAuthPreview();
  const requestAccess = useCallback(
    (destination: '/inicio' | '/carrito') => {
      if (user) return true;
      setAuthDestination(destination);
      toast.info('Inicia sesión para continuar');
      router.push('/login');
      return false;
    },
    [user, setAuthDestination, toast, router],
  );
  return { user, requestAccess };
}
