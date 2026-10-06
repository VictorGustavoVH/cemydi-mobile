/* eslint-disable @typescript-eslint/no-require-imports */
import { render, screen, waitFor } from '@testing-library/react-native';

import { HomeScreen } from '../HomeScreen';
import { CatalogPreviewProvider } from '@/providers/catalog-preview-provider';

jest.mock('expo-router', () => {
  const { useEffect } = require('react');

  return {
    useFocusEffect: (callback: () => void | (() => void)) => useEffect(callback, [callback]),
    useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  };
});

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
}));

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');

  const createSvgComponent = (name: string) => {
    const SvgComponent = (props: { children?: unknown }) =>
      React.createElement(View, props as object, props.children);
    SvgComponent.displayName = name;
    return SvgComponent;
  };

  const tags = [
    'Svg',
    'G',
    'Path',
    'Circle',
    'Rect',
    'Line',
    'Polyline',
    'Polygon',
    'Ellipse',
    'Text',
    'TSpan',
    'Defs',
    'LinearGradient',
    'RadialGradient',
    'Stop',
    'ClipPath',
    'Mask',
    'Image',
    'Symbol',
    'Use',
    'ForeignObject',
    'TextPath',
  ];

  const mock: Record<string, unknown> = { __esModule: true };

  for (const tag of tags) {
    mock[tag] = createSvgComponent(tag);
  }

  mock.default = createSvgComponent('Svg');

  return mock;
});

describe('HomeScreen', () => {
  it('muestra el catálogo de muestra después de cargar', async () => {
    await render(
      <CatalogPreviewProvider>
        <HomeScreen />
      </CatalogPreviewProvider>,
    );

    await waitFor(() => expect(screen.getByText('Para tu bienestar')).toBeTruthy());
    expect(screen.getByText(/Vista de muestra/)).toBeTruthy();
  });
});
