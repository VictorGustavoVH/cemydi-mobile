import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getFriendlyErrorMessage, UserFacingError } from '@/services/http/api-error';
import {
  accountDeletionService,
  type DeletionChallenge,
  type DeletionReceipt,
} from './account-deletion-service';

export function useAccountDeletion() {
  const auth = useAuth();
  const { isOnline } = useNetworkStatus();
  const [challenge, setChallenge] = useState<DeletionChallenge | null>(null);
  const [receipt, setReceipt] = useState<DeletionReceipt | null>(null);
  const [codigo, setCodigo] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const owner = useRef(auth.user?.id);
  useEffect(() => {
    if (auth.user && owner.current !== auth.user.id) {
      owner.current = auth.user.id;
      setChallenge(null);
      setReceipt(null);
      setCodigo('');
      setError('');
    }
  }, [auth.user]);
  const query = useQuery({
    queryKey: ['account', auth.user?.id, 'deletion'],
    queryFn: ({ signal }) => accountDeletionService.status(signal),
    enabled: auth.status === 'authenticated' && auth.user?.rol === 'CLIENT',
    retry: false,
    gcTime: 0,
  });
  async function run(action: () => Promise<void>) {
    if (
      lock.current ||
      isOnline === false ||
      !auth.user ||
      auth.getSession().user?.id !== auth.user.id
    )
      return;
    lock.current = true;
    setPending(true);
    setError('');
    const version = auth.getSessionVersion();
    try {
      await action();
    } catch (cause) {
      if (version === auth.getSessionVersion())
        setError(
          getFriendlyErrorMessage(
            cause,
            'No pudimos completar la solicitud. Revisa su estado antes de reintentar.',
          ),
        );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  function assertCurrent(version: number) {
    if (version !== auth.getSessionVersion())
      throw new UserFacingError('La sesión cambió. Vuelve a abrir tu cuenta.');
  }
  const request = () =>
    run(async () => {
      const version = auth.getSessionVersion();
      const result = await accountDeletionService.request(auth.user!.correo);
      assertCurrent(version);
      setChallenge(result);
      setCodigo('');
    });
  const confirm = () =>
    run(async () => {
      if (!/^\d{8}$/.test(codigo))
        throw new UserFacingError('Ingresa los ocho dígitos del código.');
      const version = auth.getSessionVersion();
      const result = await accountDeletionService.confirm(auth.user!.correo, codigo);
      assertCurrent(version);
      setCodigo('');
      setChallenge(null);
      setReceipt(result);
      if (result.status !== 'WAITING_OBLIGATIONS') await auth.logout();
      else await query.refetch();
    });
  return {
    correo: auth.user?.correo,
    available: auth.user?.rol === 'CLIENT',
    query,
    challenge,
    receipt: receipt ?? query.data?.request ?? null,
    codigo,
    setCodigo,
    pending,
    error,
    isOnline,
    request,
    confirm,
  };
}
