import { View, useWindowDimensions } from 'react-native';
import { CatalogImage } from '@/components/ui/CatalogImage';

export type AuthIllustrationKind = 'recovery' | 'otp' | 'password';
// Render only the artwork's occupied bounds; source files remain intact.
const illustrations = {
  recovery: {
    source: require('../../../../assets/images/auth/forgortpassword.png'),
    width: 1199,
    height: 1312,
    x: 20,
    y: 125,
    cropWidth: 1179,
    cropHeight: 1080,
  },
  otp: {
    source: require('../../../../assets/images/auth/otpEmail.png'),
    width: 1086,
    height: 1448,
    x: 50,
    y: 320,
    cropWidth: 980,
    cropHeight: 910,
  },
  password: {
    source: require('../../../../assets/images/auth/newpassword.png'),
    width: 1199,
    height: 1312,
    x: 40,
    y: 35,
    cropWidth: 1130,
    cropHeight: 1250,
  },
} as const;
export function AuthIllustration({ kind }: { kind: AuthIllustrationKind }) {
  const { width, height } = useWindowDimensions();
  const artwork = illustrations[kind];
  const frameWidth = Math.min(width - 40, 420);
  const frameHeight = Math.min(280, Math.max(210, height * 0.3));
  const scale = Math.min(frameWidth / artwork.cropWidth, frameHeight / artwork.cropHeight);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={{
        alignSelf: 'center',
        overflow: 'hidden',
        width: artwork.cropWidth * scale,
        height: artwork.cropHeight * scale,
      }}
    >
      <CatalogImage
        label=""
        accessible={false}
        compact
        source={artwork.source}
        contentFit="fill"
        style={{
          position: 'absolute',
          width: artwork.width * scale,
          height: artwork.height * scale,
          left: -artwork.x * scale,
          top: -artwork.y * scale,
        }}
      />
    </View>
  );
}
