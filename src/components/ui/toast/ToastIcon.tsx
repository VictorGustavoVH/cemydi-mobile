import CircleCheck from 'lucide-react-native/icons/circle-check';
import CircleX from 'lucide-react-native/icons/circle-x';
import Info from 'lucide-react-native/icons/info';
import { View } from 'react-native';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { colors } from '@/theme/colors';
import type { ToastConfig } from './toast-store';

export function ToastIcon({ type }: { type: Exclude<ToastConfig['type'], 'undo'> }) {
  if (type === 'loading')
    return (
      <View
        aria-hidden
        style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}
      >
        <AppSpinner size={22} color={colors.brand} decorative />
      </View>
    );
  const Icon = { success: CircleCheck, error: CircleX, info: Info }[type];
  const color = {
    success: colors.toastSuccess,
    error: colors.toastError,
    info: colors.toastInfo,
  }[type];
  return (
    <View
      aria-hidden
      style={[
        {
          width: 24,
          height: 24,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: color,
          shadowOpacity: 0.16,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 0 },
        },
      ]}
    >
      <Icon color={color} size={22} strokeWidth={2.35} />
    </View>
  );
}
