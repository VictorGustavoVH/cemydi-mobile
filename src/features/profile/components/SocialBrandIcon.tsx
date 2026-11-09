import Svg, { Path, type SvgProps } from 'react-native-svg';
import { colors } from '@/theme';
import paths from './social-icon-paths.json';

type SocialBrandIconProps = { size?: number | string; color?: SvgProps['color'] };

// Simple Icons, CC0: https://github.com/simple-icons/simple-icons
export function WhatsAppIcon({ size = 24, color = colors.brandStrong }: SocialBrandIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false} aria-hidden>
      <Path d={paths.whatsapp} fill={color} />
    </Svg>
  );
}

export function FacebookIcon({ size = 24, color = colors.textPrimary }: SocialBrandIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false} aria-hidden>
      <Path d={paths.facebook} fill={color} />
    </Svg>
  );
}
