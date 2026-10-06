import { useState } from 'react';
import { Text, View, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import ImageOff from 'lucide-react-native/icons/image-off';
import { colors } from '@/theme';

type CatalogImageProps = { source: ImageSourcePropType; label: string; compact?: boolean };

export function CatalogImage({ source, label, compact = false }: CatalogImageProps) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <View
      accessibilityLabel={`${label}: imagen no disponible`}
      className="h-full w-full items-center justify-center gap-2 p-2"
    >
      <ImageOff aria-hidden color={colors.textSecondary} size={24} />
      {!compact ? (
        <Text className="text-center font-sans text-xs text-secondary">Imagen no disponible</Text>
      ) : null}
    </View>
  ) : (
    <Image
      accessibilityLabel={label}
      style={{ width: '100%', height: '100%' }}
      onError={() => setFailed(true)}
      source={source}
      contentFit="contain"
      cachePolicy="disk"
      transition={150}
    />
  );
}
