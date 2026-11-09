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
  headerContent?: ReactNode;
  presentation?: 'sheet' | 'dialog';
  closeDisabled?: boolean;
};
export function AppSheet({
  title,
  visible,
  onClose,
  children,
  headerContent,
  presentation = 'sheet',
  closeDisabled = false,
}: AppSheetProps) {
  const dialog = presentation === 'dialog';
  const blurTarget = useRef<View | null>(null);
  return (
    <Modal
      animationType="none"
      onRequestClose={() => {
        if (!closeDisabled) onClose();
      }}
      transparent
      visible={visible}
    >
      <BlurTargetView ref={blurTarget} style={{ flex: 1 }}>
        <SafeAreaView
          className={`flex-1 bg-primary/30 ${dialog ? 'justify-center px-5' : 'justify-end'}`}
          edges={dialog ? ['top', 'bottom', 'left', 'right'] : ['top', 'left', 'right']}
        >
          <KeyboardAvoidingView
            className={`flex-1 ${dialog ? 'items-center justify-center' : 'justify-end'}`}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <SafeAreaView
              accessibilityViewIsModal
              className={`max-h-[90%] bg-background ${dialog ? 'w-full rounded-3xl' : 'rounded-t-3xl'}`}
              style={dialog ? { maxWidth: 420 } : undefined}
              edges={dialog ? [] : ['bottom']}
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
                  disabled={closeDisabled}
                  variant="ghost"
                  leftIcon={<X aria-hidden color={colors.textSecondary} size={22} />}
                />
              </View>
              {headerContent ? <View className="px-5 pt-3">{headerContent}</View> : null}
              <ScrollView
                style={{ flexShrink: 1 }}
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
