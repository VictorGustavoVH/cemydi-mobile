import { useLocalSearchParams } from 'expo-router';
import { NotificationPromotionScreen } from '@/features/notifications/NotificationPromotionScreen';
export default function NotificationPromotionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <NotificationPromotionScreen id={id ?? ''} />;
}
