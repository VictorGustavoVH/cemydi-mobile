import type { ComponentType, ComponentProps } from 'react';
import { Text, View } from 'react-native';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { AppButton } from '@/components/ui/AppButton';
import { colors } from '@/theme';

type ProfileMenuItemProps = {
  title: string;
  description: string;
  icon: ComponentType<ComponentProps<typeof ChevronRight>>;
  onPress: () => void;
  last?: boolean;
  disabled?: boolean;
};
export function ProfileMenuItem({
  title,
  description,
  icon: Icon,
  onPress,
  disabled = false,
}: ProfileMenuItemProps) {
  const color = disabled ? colors.disabled : colors.brandStrong;
  return (
    <AppButton
      label={title}
      accessibilityHint={description}
      disabled={disabled}
      variant="unstyled"
      onPress={onPress}
      className="min-h-20 flex-row items-center gap-3 py-4"
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand/5">
        <Icon aria-hidden color={color} size={21} />
      </View>
      <View className="flex-1 gap-1">
        <Text className="font-sans-semibold text-base text-primary">{title}</Text>
        <Text className="font-sans text-sm leading-5 text-secondary">{description}</Text>
      </View>
      <ChevronRight
        aria-hidden
        color={disabled ? colors.disabled : colors.textSecondary}
        size={18}
      />
    </AppButton>
  );
}
