import { ActivityIndicator, Text, View } from 'react-native';

import { colors } from '@/theme';

type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = 'Cargando…' }: LoadingStateProps) {
  return (
    <View accessibilityLiveRegion="polite" className="flex-1 items-center justify-center gap-3 p-6">
      <ActivityIndicator accessibilityLabel={label} color={colors.brandStrong} size="large" />
      <Text className="text-center text-base text-secondary">{label}</Text>
    </View>
  );
}
