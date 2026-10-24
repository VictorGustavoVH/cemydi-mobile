import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { LoadingState } from '@/components/ui/LoadingState';
import { OfflineState } from '@/components/ui/OfflineState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { getFriendlyErrorMessage } from '@/services/http/api-error';

type ResourceStateProps = {
  data: unknown;
  error: unknown;
  isError: boolean;
  isOnline: boolean | null;
  allowed?: boolean;
  retry: () => void;
  children: ReactNode;
};
export function AccountResourceState({
  data,
  error,
  isError,
  isOnline,
  allowed = true,
  retry,
  children,
}: ResourceStateProps) {
  if (!allowed)
    return (
      <EmptyState
        title="Disponible para cuentas de cliente"
        description="Esta sección corresponde a las solicitudes de una cuenta de cliente."
      />
    );
  if (data === undefined) {
    if (isOnline === false) return <OfflineState />;
    if (isError) return <ErrorState description={getFriendlyErrorMessage(error)} onRetry={retry} />;
    return <LoadingState />;
  }
  return (
    <>
      {isOnline === false || isError ? (
        <View className="gap-2 px-5 py-3">
          <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-secondary">
            {isOnline === false
              ? 'Sin conexión. Mostrando la última información disponible.'
              : 'No pudimos actualizar la información. Conservamos los últimos datos.'}
          </Text>
          {isOnline !== false ? (
            <AppButton variant="ghost" label="Reintentar" onPress={retry} />
          ) : null}
        </View>
      ) : null}
      {children}
    </>
  );
}
