import { Text, View } from 'react-native';
import ShoppingCart from 'lucide-react-native/icons/shopping-cart';
import { colors } from '@/theme';

type CartIconProps = { count: number; color?: string; appearance?: 'navigation' | 'header' };

export function CartIcon({
  count,
  color = colors.textSecondary,
  appearance = 'navigation',
}: CartIconProps) {
  const header = appearance === 'header';
  return (
    <View accessible={false} pointerEvents="none" className="relative">
      <View className={header ? '' : 'p-1'}>
        <ShoppingCart aria-hidden size={header ? 24 : 22} color={color} />
      </View>
      {count > 0 ? (
        <View
          className={`absolute -right-2 -top-1 items-center justify-center rounded-full border-[1.5px] border-background bg-brand-strong px-1 ${header ? 'min-h-4 min-w-4' : 'min-h-[18px] min-w-[18px]'}`}
        >
          <Text
            style={{ includeFontPadding: false }}
            className={`font-sans-bold leading-tight text-on-brand ${header ? 'text-[9px]' : 'text-[10px]'}`}
          >
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
