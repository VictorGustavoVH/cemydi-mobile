import { Text, View } from 'react-native';

import { AppScreen } from '@/components/ui/AppScreen';

export default function HomeScreen() {
  return (
    <AppScreen contentClassName="items-center justify-center p-6">
        <Text className="text-center text-2xl font-bold text-primary">CEMYDI</Text>
    </AppScreen>
  );
}
