import { useRef, type ReactNode } from 'react';
import { BlurTargetView } from 'expo-blur';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import X from 'lucide-react-native/icons/x';
import { AppButton } from '@/components/ui/AppButton';
import { colors } from '@/theme';
import { ToastViewport } from '@/components/ui/toast/ToastViewport';

type AppSheetProps = {
  title: string;
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
};
export function AppSheet({ title, visible, onClose, children }: AppSheetProps) {
  const blurTarget = useRef<View | null>(null);
  return (
    <Modal animationType="none" onRequestClose={onClose} transparent visible={visible}>
      <BlurTargetView ref={blurTarget} style={{ flex: 1 }}>
        <SafeAreaView className="flex-1 justify-end bg-primary/30" edges={['top', 'left', 'right']}>
          <KeyboardAvoidingView
            className="flex-1 justify-end"
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <SafeAreaView
              accessibilityViewIsModal
              className="max-h-[90%] rounded-t-3xl bg-background"
              edges={['bottom']}
            >
              <View className="flex-row items-center justify-between gap-4 px-5 pt-4">
                <Text
                  accessibilityRole="header"
                  className="flex-1 font-sans-semibold text-xl text-primary"
                >
                  {title}
                </Text>
                <AppButton
                  className="h-11 w-11 px-0 py-0"
                  hideLabel
                  label="Cerrar"
                  onPress={onClose}
                  variant="ghost"
                  leftIcon={<X aria-hidden color={colors.textSecondary} size={22} />}
                />
              </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={{ padding: 20, gap: 16 }}
              >
                {children}
              </ScrollView>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </BlurTargetView>
      {visible ? <ToastViewport modal blurTarget={blurTarget} /> : null}
    </Modal>
  );
}
