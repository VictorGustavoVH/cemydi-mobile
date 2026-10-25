import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { OfflineState } from '@/components/ui/OfflineState';
import { AppButton } from '@/components/ui/AppButton';
import { getFriendlyErrorMessage } from '@/services/http/api-error';
import type { useProfile } from '../useProfile';

type ProfileDataStateProps = { profile: ReturnType<typeof useProfile>; children: ReactNode };
export function ProfileDataState({
  profile: { query, isOnline },
  children,
}: ProfileDataStateProps) {
  if (!query.data) {
    if (isOnline === false)
      return <OfflineState description="Conéctate para consultar tus datos de perfil." />;
    if (query.isError)
      return (
        <ErrorState
          description={getFriendlyErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      );
    return <LoadingState label="Cargando tu perfil…" />;
  }
  return (
    <>
      {isOnline === false ? (
        <View className="mx-5 mb-4 rounded-xl bg-surface-muted p-4">
          <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary">
            Sin conexión. Puedes consultar tus datos; conéctate para guardarlos.
          </Text>
        </View>
      ) : null}
      {query.isError && isOnline !== false ? (
        <View className="mx-5 mb-4 gap-2 rounded-xl bg-surface-muted p-4">
          <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary">
            No pudimos actualizar tus datos. Conservamos la última información disponible.
          </Text>
          <AppButton
            variant="ghost"
            label="Actualizar perfil"
            onPress={() => void query.refetch()}
          />
        </View>
      ) : null}
      {children}
    </>
  );
}
