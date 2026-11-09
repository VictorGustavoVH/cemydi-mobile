import { useCallback, useRef, useState } from 'react';
import { Keyboard, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import EllipsisVertical from 'lucide-react-native/icons/ellipsis-vertical';
import BadgeCheck from 'lucide-react-native/icons/badge-check';
import CircleHelp from 'lucide-react-native/icons/circle-question-mark';
import { AppButton } from '@/components/ui/AppButton';
import { AppScreenPopover } from '@/components/ui/AppScreenPopover';
import { colors } from '@/theme';

type AuthHeaderMenuProps = {
  disabled?: boolean;
  onVerify: () => void;
  onHelp: () => void;
};

export function AuthHeaderMenu({ disabled = false, onVerify, onHelp }: AuthHeaderMenuProps) {
  const anchor = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [previousDisabled, setPreviousDisabled] = useState(disabled);
  const close = useCallback(() => setOpen(false), []);
  useFocusEffect(useCallback(() => close, [close]));
  if (disabled !== previousDisabled) {
    setPreviousDisabled(disabled);
    if (disabled) close();
  }

  return (
    <View ref={anchor} collapsable={false}>
      <AppButton
        label="Opciones de acceso"
        hideLabel
        variant="ghost"
        className="h-11 w-11 px-0 py-0"
        accessibilityState={{ expanded: open }}
        accessibilityHint="Verificar tu cuenta o consultar ayuda"
        disabled={disabled}
        leftIcon={<EllipsisVertical aria-hidden size={24} color={colors.textPrimary} />}
        onPress={() => {
          Keyboard.dismiss();
          setOpen((current) => !current);
        }}
      />
      {open && !disabled ? (
        <AppScreenPopover
          anchor={anchor}
          preferredWidth={216}
          align="end"
          animate
          onDismiss={close}
        >
          <ScrollView
            accessibilityLabel="Opciones de acceso disponibles"
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 3 }}
            className="rounded-[20px] border border-border-subtle bg-surface"
            style={{ elevation: 4, boxShadow: '0 8px 24px rgba(15,23,42,0.08)' }}
          >
            <AppButton
              label="Verificar cuenta"
              variant="unstyled"
              className="min-h-11 flex-row items-center gap-2 rounded-xl px-2 py-1 active:bg-surface-muted"
              leftIcon={<BadgeCheck aria-hidden size={22} color={colors.brandStrong} />}
              onPress={() => {
                close();
                onVerify();
              }}
            >
              <Text
                className="min-w-0 flex-1 font-sans text-base"
                style={{ color: colors.menuText }}
              >
                Verificar cuenta
              </Text>
            </AppButton>
            <AppButton
              label="Ayuda"
              variant="unstyled"
              className="min-h-11 flex-row items-center gap-2 rounded-xl px-2 py-1 active:bg-surface-muted"
              leftIcon={<CircleHelp aria-hidden size={22} color={colors.accentSky} />}
              onPress={() => {
                close();
                onHelp();
              }}
            >
              <Text
                className="min-w-0 flex-1 font-sans text-base"
                style={{ color: colors.menuText }}
              >
                Ayuda
              </Text>
            </AppButton>
          </ScrollView>
        </AppScreenPopover>
      ) : null}
    </View>
  );
}
