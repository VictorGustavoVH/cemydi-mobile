import { useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withSpring } from 'react-native-reanimated';
import { AppButton } from '@/components/ui/AppButton';
import { colors } from '@/theme';
export const notificationFilters = [
  ['ALL', 'Todas'],
  ['RENTAL', 'Rentas'],
  ['SYSTEM', 'Sistema'],
  ['OFFER', 'Ofertas'],
] as const;
export function NotificationTabs({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [width, setWidth] = useState(0);
  const reducedMotion = useReducedMotion();
  const tabWidth = width / notificationFilters.length;
  const index = Math.max(
    0,
    notificationFilters.findIndex(([id]) => id === value),
  );
  const indicator = useAnimatedStyle(
    () => ({
      opacity: width > 0 ? 1 : 0,
      width: reducedMotion ? tabWidth : withSpring(tabWidth, { stiffness: 400, damping: 32 }),
      transform: [
        {
          translateX: reducedMotion
            ? index * tabWidth
            : withSpring(index * tabWidth, { stiffness: 400, damping: 32 }),
        },
      ],
    }),
    [width, tabWidth, index, reducedMotion],
  );
  return (
    <View
      accessibilityLabel="Filtrar notificaciones"
      onLayout={({ nativeEvent: { layout } }) =>
        setWidth((current) => (current === layout.width ? current : layout.width))
      }
      style={{
        position: 'relative',
        flexDirection: 'row',
        justifyContent: 'center',
        minHeight: 51,
        paddingBottom: 3,
      }}
    >
      {notificationFilters.map(([id, label]) => (
        <AppButton
          key={id}
          label={label}
          variant="ghost"
          accessibilityRole="tab"
          accessibilityState={{ selected: value === id }}
          className="min-h-12 rounded-none px-0"
          style={{ flex: 1, minWidth: 0, paddingHorizontal: 0 }}
          labelClassName={value === id ? 'text-sm text-brand-strong' : 'text-sm text-secondary'}
          onPress={() => {
            if (value !== id) onChange(id);
          }}
        />
      ))}
      <Animated.View
        testID="notification-tab-indicator"
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: 3,
            borderRadius: 2,
            backgroundColor: colors.brandStrong,
          },
          indicator,
        ]}
      />
    </View>
  );
}
