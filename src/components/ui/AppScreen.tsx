import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

type AppScreenProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  edges?: Edge[];
  scroll?: boolean;
};

const scrollContentStyle = { flexGrow: 1 } as const;

export function AppScreen({
  children,
  className = '',
  contentClassName = '',
  edges = ['bottom', 'left', 'right'],
  scroll = false,
}: AppScreenProps) {
  return (
    <SafeAreaView className={`flex-1 bg-background ${className}`} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={scrollContentStyle}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        >
          <View className={`flex-1 ${contentClassName}`}>{children}</View>
        </ScrollView>
      ) : (
        <View className={`flex-1 ${contentClassName}`}>{children}</View>
      )}
    </SafeAreaView>
  );
}
