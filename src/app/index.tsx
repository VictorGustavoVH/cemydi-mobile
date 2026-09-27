import { Text } from 'react-native';

import { AppScreen } from '@/components/ui/AppScreen';
import { ApiConnectionCheck } from '@/features/api-connection/ApiConnectionCheck';

export default function HomeScreen() {
  return (
    <AppScreen contentClassName="items-center justify-center gap-6 p-6" scroll>
      <Text className="text-center text-2xl font-bold text-primary">CEMYDI</Text>
      <ApiConnectionCheck />
    </AppScreen>
  );
}
