import { useState } from 'react';
import { StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { Image, type ImageProps } from 'expo-image';
import { useReducedMotion } from 'react-native-reanimated';
import ImageOff from 'lucide-react-native/icons/image-off';
import { colors } from '@/theme';
import { getLocalImageBlurhash } from '@/data/local-image-placeholders';

type CatalogImageProps = {
  source: ImageSourcePropType | undefined;
  label: string;
  compact?: boolean;
  blurhash?: string;
  contentFit?: ImageProps['contentFit'];
  style?: ImageProps['style'];
  accessible?: boolean;
};

export function CatalogImage(props: CatalogImageProps) {
  // A source change also resets a previous failure, including in recycled cells.
  const identity = JSON.stringify(props.source);
  return <CatalogImageContent key={identity} {...props} identity={identity} />;
}

function CatalogImageContent({
  source,
  label,
  compact = false,
  blurhash,
  contentFit = 'contain',
  style,
  accessible = true,
  identity,
}: CatalogImageProps & { identity: string }) {
  const [failed, setFailed] = useState(false);
  const reducedMotion = useReducedMotion();
  const placeholderHash = blurhash ?? (source ? getLocalImageBlurhash(source) : undefined);
  const remote = (Array.isArray(source) ? source : [source]).some(
    (item) => item && typeof item === 'object' && /^https?:\/\//i.test(item.uri ?? ''),
  );
  return failed || !source ? (
    <View
      accessible={accessible}
      accessibilityLabel={`${label}: imagen no disponible`}
      className="items-center justify-center gap-2 p-2"
      style={[styles.image, style]}
    >
      <ImageOff aria-hidden color={colors.textSecondary} size={24} />
      {!compact ? (
        <Text className="text-center font-sans text-xs text-secondary">Imagen no disponible</Text>
      ) : null}
    </View>
  ) : (
    <Image
      accessible={accessible}
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.image, remote && styles.remote, style]}
      onError={() => setFailed(true)}
      source={source}
      contentFit={contentFit}
      placeholder={placeholderHash ? { blurhash: placeholderHash } : undefined}
      placeholderContentFit={contentFit}
      recyclingKey={identity}
      cachePolicy="memory-disk"
      transition={(remote || placeholderHash) && !reducedMotion ? 150 : 0}
    />
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
  remote: { backgroundColor: colors.surfaceMuted },
});
