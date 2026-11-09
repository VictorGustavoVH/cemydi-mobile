import { Text, View } from 'react-native';

export function UnreadBadge({ count, showZero = false }: { count: number; showZero?: boolean }) {
  if (!count && !showZero) return null;
  return (
    <View
      accessibilityLabel={`${count} notificaciones sin leer`}
      accessibilityLiveRegion="polite"
      className="min-h-[18px] min-w-[18px] items-center justify-center rounded-full border-[1.5px] border-background bg-brand-strong px-1"
    >
      <Text
        style={{ includeFontPadding: false }}
        className="font-sans-bold text-[10px] leading-tight text-on-brand"
      >
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}
