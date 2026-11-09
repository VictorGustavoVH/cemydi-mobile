import type { ComponentType, ComponentProps } from 'react';
import { Text, View } from 'react-native';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { AppButton } from '@/components/ui/AppButton';
import { colors } from '@/theme';

type AccountMenuItemProps = {
  title: string;
  description: string;
  icon: ComponentType<ComponentProps<typeof ChevronRight>>;
  onPress: () => void;
  last?: boolean;
  disabled?: boolean;
  selectableDescription?: boolean;
  appearance?: 'plain' | 'divided';
  iconTone?:
    | 'brandStrong'
    | 'info'
    | 'warning'
    | 'success'
    | 'textSecondary'
    | 'favorite'
    | 'accentViolet'
    | 'accentOrange'
    | 'accentRose'
    | 'accentCyan'
    | 'accentIndigo'
    | 'accentSky';
};
export function AccountMenuItem({
  title,
  description,
  icon: Icon,
  onPress,
  disabled = false,
  selectableDescription = false,
  appearance = 'plain',
  iconTone = 'brandStrong',
}: AccountMenuItemProps) {
  const color = disabled ? colors.disabled : colors[iconTone];
  return (
    <AppButton
      label={title}
      accessibilityHint={description}
      disabled={disabled}
      variant="unstyled"
      onPress={onPress}
      className={`min-h-20 flex-row items-center gap-3 ${appearance === 'divided' ? 'border-b border-border py-4' : 'py-4'}`}
    >
      <View className="w-8 items-center justify-center">
        <Icon aria-hidden color={color} size={24} />
      </View>
      <View className="flex-1 gap-1">
        <Text className="font-sans-semibold text-base text-primary">{title}</Text>
        <Text
          selectable={selectableDescription}
          className="font-sans text-sm leading-5 text-secondary"
        >
          {description}
        </Text>
      </View>
      <ChevronRight
        aria-hidden
        color={disabled ? colors.disabled : colors.textSecondary}
        size={18}
      />
    </AppButton>
  );
}
