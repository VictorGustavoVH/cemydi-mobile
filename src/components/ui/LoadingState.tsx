import { ActivityIndicator, Text, View } from 'react-native';

import { colors } from '@/theme';

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
      <ActivityIndicator
        accessibilityLabel={label}
        color={colors.brandStrong}
        size={compact ? 'small' : 'large'}
      />
      {!hideLabel && <Text className="text-center text-base text-secondary">{label}</Text>}
    </View>
  );
}
