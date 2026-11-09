import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { OfflineState } from '@/components/ui/OfflineState';
import { AppButton } from '@/components/ui/AppButton';
import { getFriendlyErrorMessage } from '@/services/http/api-error';
import type { useProfile } from '../useProfile';

type ProfileDataStateProps = {
  profile: ReturnType<typeof useProfile>;
  children: ReactNode;
  /**
   * Mantiene el contenido con la identidad de la sesión cuando el perfil aún
   * no está disponible (carga, error u offline). Se usa en el menú principal
   * para que las opciones sigan accesibles; el formulario de edición no lo
   * activa porque necesita los datos completos del servidor.
   */
  fallbackToSession?: boolean;
};
export function ProfileDataState({
  profile: { query, isOnline, user },
  children,
  fallbackToSession = false,
}: ProfileDataStateProps) {
  const hasData = Boolean(query.data);
  const usesSession = !hasData && fallbackToSession && Boolean(user);
  if (!hasData && !usesSession) {
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
            {hasData
              ? 'Sin conexión. Puedes consultar tus datos; conéctate para guardarlos.'
              : 'Sin conexión. Mostramos la información de tu sesión; conéctate para actualizarla.'}
          </Text>
        </View>
      ) : null}
      {query.isError && isOnline !== false ? (
        <View className="mx-5 mb-4 gap-2 rounded-xl bg-surface-muted p-4">
          <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary">
            {hasData
              ? 'No pudimos actualizar tus datos. Conservamos la última información disponible.'
              : 'No pudimos actualizar tus datos. Mostramos la información de tu sesión.'}
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
