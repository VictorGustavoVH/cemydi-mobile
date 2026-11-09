import type { ComponentProps, ComponentType } from 'react';
import { Text, View } from 'react-native';
import UserRound from 'lucide-react-native/icons/user-round';
import { colors } from '@/theme';
import { FormStepProgress } from '@/components/account/FormStepProgress';

type ProfileFormHeadingProps = {
  icon: ComponentType<ComponentProps<typeof UserRound>>;
  title: string;
  description: string;
  step?: 1 | 2;
  tone?: 'brand' | 'danger';
};

export function ProfileFormHeading({
  icon: Icon,
  title,
  description,
  step,
  tone = 'brand',
}: ProfileFormHeadingProps) {
  return (
    <View className="gap-4 pb-2">
      <View
        className={`h-14 w-14 items-center justify-center rounded-2xl ${tone === 'danger' ? 'bg-danger/5' : 'bg-brand/10'}`}
      >
        <Icon
          aria-hidden
          size={28}
          color={tone === 'danger' ? colors.danger : colors.brandStrong}
        />
      </View>
      <View className="gap-2">
        <Text accessibilityRole="header" className="font-sans-bold text-2xl leading-8 text-primary">
          {title}
        </Text>
        <Text className="font-sans text-sm leading-6 text-secondary">{description}</Text>
      </View>
      {step ? <FormStepProgress step={step} tone={tone} /> : null}
    </View>
  );
}
