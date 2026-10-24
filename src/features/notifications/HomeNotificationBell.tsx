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
    <View className="relative">
      <AppButton
        className="h-11 w-11 px-0 py-0"
        hideLabel
        label="Notificaciones"
        accessibilityLabel={count ? `Notificaciones, ${count} sin leer` : 'Notificaciones'}
        onPress={() => {
          requestPermission();
          onPress();
        }}
        variant="secondary"
        leftIcon={<Bell aria-hidden color={colors.textPrimary} size={21} />}
      />
      <View pointerEvents="none" accessible={false} className="absolute -right-1 -top-1">
        <UnreadBadge count={count} />
      </View>
    </View>
  );
}
