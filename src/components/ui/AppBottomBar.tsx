import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import House from 'lucide-react-native/icons/house';
import Search from 'lucide-react-native/icons/search';
import ShoppingCart from 'lucide-react-native/icons/shopping-cart';
import UserRound from 'lucide-react-native/icons/user-round';
import { AppButton } from '@/components/ui/AppButton';
import { colors } from '@/theme';

type TabKey = 'home' | 'explore' | 'cart' | 'profile';

type AppBottomBarProps = {
  onHome: () => void;
  onExplore: () => void;
  onCart: () => void;
  onProfile: () => void;
  cartCount?: number;
  selectedTab?: TabKey;
};

type TabItemProps = {
  label: string;
  icon: typeof House;
  onPress: () => void;
  selected: boolean;
  badgeCount?: number;
};

function TabItem({ label, icon: Icon, onPress, selected, badgeCount = 0 }: TabItemProps) {
  const reducedMotion = useReducedMotion();
  const pressScale = useSharedValue(1);
  const pop = useSharedValue(1);
  const barOpacity = useSharedValue(selected ? 1 : 0);
  const barScale = useSharedValue(selected ? 1 : 0.4);

  useEffect(() => {
    barOpacity.set(withTiming(selected ? 1 : 0, { duration: 160 }));
    barScale.set(withTiming(selected ? 1 : 0.4, { duration: 160 }));
    if (selected && !reducedMotion) {
      pop.set(1.18);
      pop.set(withSpring(1, { duration: 320, dampingRatio: 0.6 }));
    } else {
      pop.set(1);
    }
  }, [selected, reducedMotion, barOpacity, barScale, pop]);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  const barStyle = useAnimatedStyle(() => ({
    opacity: barOpacity.value,
    transform: [{ scaleX: barScale.value }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  return (
    <AppButton
      accessibilityState={{ selected }}
      className="flex-1 px-0 py-1.5"
      label={label}
      accessibilityLabel={
        badgeCount > 0
          ? `${label}, ${badgeCount} ${badgeCount === 1 ? 'unidad' : 'unidades'}`
          : label
      }
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      onPressIn={() => {
        pressScale.set(reducedMotion ? 1 : withTiming(0.94, { duration: 110 }));
      }}
      onPressOut={() => {
        pressScale.set(reducedMotion ? 1 : withTiming(1, { duration: 140 }));
      }}
      variant="unstyled"
    >
      <View className="items-center gap-1">
        <Animated.View style={pressStyle} className="items-center gap-1">
          <View className="items-center">
            <View className="relative px-3 py-1">
              <Animated.View style={iconStyle}>
                <Icon
                  aria-hidden
                  color={selected ? colors.brandStrong : colors.textSecondary}
                  size={22}
                />
              </Animated.View>
              {badgeCount > 0 ? (
                <View
                  pointerEvents="none"
                  accessible={false}
                  className="absolute -top-1 right-0 min-w-5 items-center rounded-full border-2 border-background bg-brand-strong px-1"
                >
                  <Text className="font-sans-bold text-[10px] text-on-brand">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <Text
            className={`text-[11px] ${selected ? 'font-sans-semibold text-brand-strong' : 'font-sans text-secondary'}`}
          >
            {label}
          </Text>
          <Animated.View style={barStyle} className="mt-0.5 h-[3px] w-6 rounded-full bg-brand" />
        </Animated.View>
      </View>
    </AppButton>
  );
}

export function AppBottomBar({
  onHome,
  onExplore,
  onCart,
  onProfile,
  cartCount = 0,
  selectedTab,
}: AppBottomBarProps) {
  const [active, setActive] = useState<TabKey>('home');
  const items: { key: TabKey; label: string; icon: typeof House; onPress: () => void }[] = [
    { key: 'home', label: 'Inicio', icon: House, onPress: onHome },
    { key: 'explore', label: 'Explorar', icon: Search, onPress: onExplore },
    { key: 'cart', label: 'Carrito', icon: ShoppingCart, onPress: onCart },
    { key: 'profile', label: 'Perfil', icon: UserRound, onPress: onProfile },
  ];
  return (
    <View className="flex-row border-t border-border/40 bg-background px-3 pb-1 pt-2">
      {items.map(({ key, label, icon, onPress }) => (
        <TabItem
          key={key}
          label={label}
          icon={icon}
          selected={(selectedTab ?? active) === key}
          badgeCount={key === 'cart' ? cartCount : 0}
          onPress={() => {
            if (key === 'home' || key === 'explore') setActive(key);
            onPress();
          }}
        />
      ))}
    </View>
  );
}
