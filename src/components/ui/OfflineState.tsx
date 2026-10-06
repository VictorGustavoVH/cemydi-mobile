import { Text, View } from 'react-native';

type OfflineStateProps = {
  title?: string;
  description?: string;
};

export function OfflineState({
  title = 'Sin conexión',
  description = 'Revisa tu conexión a internet e intenta de nuevo.',
}: OfflineStateProps) {
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
    </View>
  );
}
