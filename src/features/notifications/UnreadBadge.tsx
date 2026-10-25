import { Text, View } from 'react-native';

export function UnreadBadge({ count, showZero = false }: { count: number; showZero?: boolean }) {
  if (!count && !showZero) return null;
  return (
    <View
      accessibilityLabel={`${count} notificaciones sin leer`}
      accessibilityLiveRegion="polite"
      className="min-w-5 items-center rounded-full border-2 border-background bg-brand-strong px-1"
    >
      <Text className="font-sans-bold text-[10px] text-on-brand">{count > 99 ? '99+' : count}</Text>
    </View>
  );
}
