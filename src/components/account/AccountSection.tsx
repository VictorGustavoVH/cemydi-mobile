import { useState, type ReactNode, type ComponentType, type ComponentProps } from 'react';
import { Text, View } from 'react-native';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import { AppButton } from '@/components/ui/AppButton';
import { colors } from '@/theme';

type AccountSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  collapsible?: boolean;
  icon?: ComponentType<ComponentProps<typeof ChevronDown>>;
  iconTone?: 'info' | 'warning' | 'success' | 'textSecondary';
};

export function AccountSection({
  title,
  description,
  children,
  collapsible = false,
  icon: Icon,
  iconTone = 'textSecondary',
}: AccountSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = !collapsible || expanded;
  const Chevron = expanded ? ChevronUp : ChevronDown;
  return (
    <View className="gap-3">
      {collapsible ? (
        <AppButton
          label={title}
          variant="unstyled"
          accessibilityState={{ expanded }}
          accessibilityHint={
            expanded ? 'Toca para ocultar los detalles.' : 'Toca para consultar los detalles.'
          }
          onPress={() => setExpanded((value) => !value)}
          className="min-h-11 flex-row items-center justify-between gap-3 py-2"
        >
          {Icon ? <Icon aria-hidden size={20} color={colors[iconTone]} /> : null}
          <Text className="flex-1 font-sans-semibold text-base text-primary">{title}</Text>
          <Chevron aria-hidden size={20} color={colors.textSecondary} />
        </AppButton>
      ) : (
        <View className="flex-row items-center gap-2">
          {Icon ? <Icon aria-hidden size={20} color={colors[iconTone]} /> : null}
          <Text
            accessibilityRole="header"
            className="min-w-0 flex-1 font-sans-semibold text-base text-primary"
          >
            {title}
          </Text>
        </View>
      )}
      {visible ? (
        <View className="gap-3">
          {description ? (
            <Text className="font-sans text-sm leading-6 text-secondary">{description}</Text>
          ) : null}
          {children}
        </View>
      ) : null}
    </View>
  );
}
