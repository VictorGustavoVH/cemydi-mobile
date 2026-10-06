import { Text, View } from 'react-native';

import { AppButton } from './AppButton';

type ErrorStateProps = {
  title?: string;
  description?: string;
  actionLabel?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = 'No pudimos cargar la información',
  description = 'Ocurrió un problema al obtener los datos. Intenta de nuevo.',
  actionLabel = 'Reintentar',
  onRetry,
}: ErrorStateProps) {
  return (
    <View
      accessibilityLiveRegion="assertive"
      className="flex-1 items-center justify-center gap-3 p-6"
    >
      <Text
        accessibilityRole="header"
        className="text-center font-sans-semibold text-lg text-primary"
      >
        {title}
      </Text>
      <Text className="text-center font-sans text-sm text-secondary">{description}</Text>
      {onRetry ? <AppButton label={actionLabel} onPress={onRetry} /> : null}
    </View>
  );
}
