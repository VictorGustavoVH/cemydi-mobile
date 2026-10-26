import { useEffect, useRef, useState } from 'react';
import { getFriendlyErrorMessage } from '@/services/http/api-error';
import { useToast } from '@/hooks/useToast';

export function useAuthAction() {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function execute(
    action: () => void | Promise<void>,
    successMessage: string,
    onSuccess: () => void,
  ) {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    try {
      await Promise.resolve().then(action);
      if (mounted.current) {
        toast.success(successMessage);
        onSuccess();
      }
    } catch (error) {
      if (mounted.current) toast.error(getFriendlyErrorMessage(error));
    } finally {
      locked.current = false;
      if (mounted.current) setPending(false);
    }
  }
  return { pending, execute };
}
