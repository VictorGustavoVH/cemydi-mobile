import { useEffect, useRef, useState } from 'react';
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
  async function execute(action: () => void, successMessage: string, onSuccess: () => void) {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    try {
      // A separate service boundary keeps the temporary flow replaceable.
      await Promise.resolve().then(action);
      if (mounted.current) {
        toast.success(successMessage);
        onSuccess();
      }
    } catch (error) {
      if (mounted.current)
        toast.error(error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      locked.current = false;
      if (mounted.current) setPending(false);
    }
  }
  return { pending, execute };
}
