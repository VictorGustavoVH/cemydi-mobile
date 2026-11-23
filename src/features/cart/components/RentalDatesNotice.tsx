import { Text, View } from 'react-native';
import Info from 'lucide-react-native/icons/info';
import { colors } from '@/theme';

export function RentalDatesNotice() {
  return (
    <View accessibilityLiveRegion="polite" className="flex-row items-start gap-2">
      <Info aria-hidden size={18} color={colors.rental} style={{ marginTop: 3 }} />
      <Text className="min-w-0 flex-1 font-sans-medium text-sm leading-6 text-rental">
        El total está incompleto: configura las fechas de las rentas pendientes.
      </Text>
    </View>
  );
}
