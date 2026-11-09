import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import Package from 'lucide-react-native/icons/package';
import { CatalogImage } from '@/components/ui/CatalogImage';
import { colors } from '@/theme';

type ProfileProductRowProps = {
  name: string;
  imageUrl: string | null;
  description?: string;
  children?: ReactNode;
};

export function ProfileProductRow({
  name,
  imageUrl,
  description,
  children,
}: ProfileProductRowProps) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-background">
        {imageUrl ? (
          <CatalogImage source={{ uri: imageUrl }} label={name} compact accessible={false} />
        ) : (
          <Package aria-hidden size={24} color={colors.textSecondary} />
        )}
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <Text className="font-sans-semibold text-base leading-6 text-primary">{name}</Text>
        {description ? (
          <Text className="font-sans text-sm leading-5 text-secondary">{description}</Text>
        ) : null}
        {children}
      </View>
    </View>
  );
}
