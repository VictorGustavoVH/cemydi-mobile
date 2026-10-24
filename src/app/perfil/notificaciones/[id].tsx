import { useLocalSearchParams } from 'expo-router';
import { NotificationRedirectScreen } from '@/features/notifications/NotificationRedirectScreen';
export default function NotificationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <NotificationRedirectScreen id={id ?? ''} />;
}
