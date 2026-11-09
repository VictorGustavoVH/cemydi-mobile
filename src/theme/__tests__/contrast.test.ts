import { colors } from '../colors';

function luminance(hex: string) {
  const rgb = [1, 3, 5]
    .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(first: string, second: string) {
  const a = luminance(first),
    b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

it.each([
  [colors.onBrand, colors.brandStrong],
  [colors.onBrand, colors.brandPressed],
  [colors.onBrand, colors.rental],
  [colors.brandStrong, colors.brandMuted],
  [colors.textSecondary, colors.surface],
  [colors.textSecondary, colors.surfaceMuted],
  [colors.brandStrong, colors.surface],
  [colors.brandStrong, colors.surfaceMuted],
  [colors.accentViolet, colors.surface],
  [colors.accentOrange, colors.surface],
  [colors.accentRose, colors.surface],
  [colors.accentCyan, colors.surface],
  [colors.accentIndigo, colors.surface],
  [colors.accentSky, colors.surface],
])('mantiene contraste AA de texto entre %s y %s', (foreground, background) => {
  expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
});

it('conserva la marca y comparte sus valores con NativeWind', () => {
  expect(colors.brand).toBe('#258e8b');
  const config = jest.requireActual<{ theme: { extend: { colors: Record<string, string> } } }>(
    '../../../tailwind.config.js',
  );
  expect(config.theme.extend.colors['brand-strong']).toBe(colors.brandStrong);
  expect(config.theme.extend.colors.secondary).toBe(colors.textSecondary);
});
