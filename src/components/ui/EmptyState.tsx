import { type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { AppButton } from './AppButton';

type EmptyStateProps = {
  icon?: ReactNode;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Ocupa todo el alto disponible. Desactívalo al usarlo dentro de una sección. */
  fill?: boolean;
};

export function EmptyState({
  icon,
  title = 'No hay nada por aquí',
  description = 'Cuando haya contenido disponible lo verás en esta sección.',
  actionLabel,
  onAction,
  fill = true,
}: EmptyStateProps) {
  return (
    <View className={`items-center justify-center gap-3 ${fill ? 'flex-1 p-6' : 'px-6 py-4'}`}>
      {icon}
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
