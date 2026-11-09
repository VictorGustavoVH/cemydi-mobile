import { Text, View } from 'react-native';

import { AppSpinner } from './AppSpinner';

type LoadingStateProps = {
  label?: string;
  compact?: boolean;
  hideLabel?: boolean;
};

export function LoadingState({
  label = 'Cargando…',
  compact = false,
  hideLabel = false,
}: LoadingStateProps) {
  return (
    <View
      accessibilityLiveRegion="polite"
      className={
        compact
          ? 'min-h-11 items-center justify-center p-2'
          : 'flex-1 items-center justify-center gap-3 p-6'
      }
    >
      <AppSpinner label={label} size={compact ? 22 : 40} />
      {!hideLabel && (
        <Text className="text-center font-sans-medium text-sm text-secondary">{label}</Text>
      )}
    </View>
  );
}
