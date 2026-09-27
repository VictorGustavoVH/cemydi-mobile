import { Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { isApiError } from '@/services/http/api-error';

import { useApiConnectionCheck } from './hooks/use-api-connection-check';

function getConnectionErrorMessage(error: unknown): string {
  if (!isApiError(error)) {
    return 'Ocurrió un error inesperado al comprobar la conexión.';
  }

  if (error.kind === 'network') {
    return 'No fue posible conectar con la API. Revisa la red y la URL configurada.';
  }

  if (error.kind === 'timeout') {
    return 'La API no respondió antes de que terminara el tiempo de espera.';
  }

  if (error.kind === 'http') {
    return `La API respondió con el estado ${error.status ?? 'desconocido'}.`;
  }

  return error.message;
}

export function ApiConnectionCheck() {
  const connectionQuery = useApiConnectionCheck();

  const runConnectionCheck = () => {
    void connectionQuery.refetch();
  };

  return (
    <View className="w-full max-w-md gap-4 rounded-2xl border border-border bg-surface p-5">
      <View className="gap-1">
        <Text className="text-lg font-semibold text-primary">Conexión con la API</Text>
        <Text className="text-sm leading-5 text-secondary">
          Envía una solicitud segura al endpoint público confirmado del backend.
        </Text>
      </View>

      <AppButton
        label="Probar conexión"
        loading={connectionQuery.isFetching}
        onPress={runConnectionCheck}
      />

      {connectionQuery.isSuccess ? (
        <View
          accessibilityLiveRegion="polite"
          className="rounded-xl border border-brand bg-surface-muted p-3"
        >
          <Text className="font-semibold text-brand-strong">Conexión correcta</Text>
          <Text className="mt-1 text-sm text-primary">Respuesta: {connectionQuery.data}</Text>
        </View>
      ) : null}

      {connectionQuery.isError ? (
        <View
          accessibilityLiveRegion="assertive"
          className="rounded-xl border border-danger bg-surface-muted p-3"
        >
          <Text className="font-semibold text-danger">No se pudo completar la prueba</Text>
          <Text className="mt-1 text-sm text-primary">
            {getConnectionErrorMessage(connectionQuery.error)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
