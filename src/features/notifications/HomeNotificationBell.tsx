import { View } from 'react-native';
import Bell from 'lucide-react-native/icons/bell';
import { AppButton } from '@/components/ui/AppButton';
import { colors } from '@/theme';
import { useNotifications } from './useNotifications';
import { useNotificationPermissionAccess } from './useNotificationPermissionAccess';
import { UnreadBadge } from './UnreadBadge';

export function HomeNotificationBell({ onPress }: { onPress: () => void }) {
  const { query } = useNotifications();
  const count = query.data?.unreadCount ?? 0;
  const requestPermission = useNotificationPermissionAccess();
  return (
    <AppButton
      className="h-11 w-11 rounded-full px-0 py-0"
      hideLabel
      label="Notificaciones"
      accessibilityLabel={count ? `Notificaciones, ${count} sin leer` : 'Notificaciones'}
      onPress={() => {
        requestPermission();
        onPress();
      }}
      variant="ghost"
      leftIcon={
        <View className="relative">
          <Bell aria-hidden color={colors.textPrimary} size={22} />
          <View pointerEvents="none" accessible={false} className="absolute -right-2 -top-1.5">
            <UnreadBadge count={count} />
          </View>
        </View>
      }
    />
  );
}
