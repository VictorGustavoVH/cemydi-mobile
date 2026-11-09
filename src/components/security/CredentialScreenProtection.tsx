import { useCallback, useId, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { allowScreenCaptureAsync, preventScreenCaptureAsync } from 'expo-screen-capture';
import { AppScreen } from '@/components/ui/AppScreen';
import { BackButton } from '@/components/ui/BackButton';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';

type CredentialScreenProtectionProps = { children: ReactNode };

export function CredentialScreenProtection({ children }: CredentialScreenProtectionProps) {
  const id = useId();
  const focusCount = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'pending' | 'protected' | 'error'>('pending');

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;
      const key = `credentials-${id}-${++focusCount.current}-${attempt}`;
      let focused = true;
      setStatus('pending');
      const protection = preventScreenCaptureAsync(key);
      void protection.then(
        () => {
          if (focused) setStatus('protected');
        },
        () => {
          if (focused) setStatus('error');
        },
      );
      return () => {
        focused = false;
        setStatus('pending');
        // Keep the key until activation settles, including fast navigation away.
        void protection
          .catch(() => undefined)
          .then(() => allowScreenCaptureAsync(key))
          .catch(() => {
            // Failing to release leaves capture blocked; no credentials are exposed.
          });
      };
    }, [attempt, id]),
  );

  if (Platform.OS !== 'android' || status === 'protected') return children;
  // Do not render credentials before Android confirms FLAG_SECURE.
  return (
    <AppScreen>
      <BackButton fallbackHref="/inicio" />
      {status === 'error' ? (
        <ErrorState
          title="No pudimos proteger esta pantalla"
          description="Reintenta para continuar de forma segura."
          onRetry={() => setAttempt((value) => value + 1)}
        />
      ) : (
        <LoadingState label="Preparando acceso seguro…" />
      )}
    </AppScreen>
  );
}
