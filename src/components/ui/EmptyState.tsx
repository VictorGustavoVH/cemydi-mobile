import { Text, View } from 'react-native';

import { AppButton } from './AppButton';

type EmptyStateProps = {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  title = 'No hay nada por aquí',
  description = 'Cuando haya contenido disponible lo verás en esta sección.',
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 p-6">
      <Text
        accessibilityRole="header"
        className="text-center font-sans-semibold text-lg text-primary"
      >
        {title}
      </Text>
      <Text className="text-center font-sans text-sm text-secondary">{description}</Text>
      {actionLabel && onAction ? <AppButton label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}
