import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { OnboardingScreen } from './OnboardingScreen';
import { hasCompletedOnboarding } from './onboarding-progress';

type ProgressStatus = 'loading' | 'first-visit' | 'completed' | 'error';

export function OnboardingGate() {
  const [status, setStatus] = useState<ProgressStatus>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void hasCompletedOnboarding()
      .then((completed) => {
        if (active) setStatus(completed ? 'completed' : 'first-visit');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  if (status === 'completed') return <Redirect href="/inicio" />;
  if (status === 'first-visit') return <OnboardingScreen />;

  return (
    <View className="flex-1 bg-white">
      {status === 'loading' ? (
        <LoadingState label="Preparando la aplicación" />
      ) : (
        <ErrorState
          title="No pudimos comprobar la introducción"
          description="Intenta de nuevo para continuar sin perder tu progreso."
          onRetry={() => {
            setStatus('loading');
            setAttempt((previous) => previous + 1);
          }}
        />
      )}
    </View>
  );
}
