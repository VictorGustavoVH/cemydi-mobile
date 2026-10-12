/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { addRecentSearch, clearRecentSearches } from '@/hooks/useRecentSearches';
import { render } from '../../../../tests/support/render-with-toast';

import { HomeScreen } from '../HomeScreen';
import { CatalogPreviewProvider } from '@/providers/catalog-preview-provider';
import { installHomePreviewApiMock } from '../../../../tests/support/home-preview-api-mock';

jest.mock('expo-router', () => {
  const { useEffect } = require('react');

  return {
    useFocusEffect: (callback: () => void | (() => void)) => useEffect(callback, [callback]),
    useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
    useLocalSearchParams: () => ({}),
  };
});

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
}));

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn().mockResolvedValue({ isInternetReachable: true }),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
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
  beforeEach(() => {
    installHomePreviewApiMock();
    clearRecentSearches();
  });
  it('muestra como máximo seis productos y acceso al catálogo completo', async () => {
    await render(
      <CatalogPreviewProvider>
        <HomeScreen />
      </CatalogPreviewProvider>,
    );

    await waitFor(() => expect(screen.getByText('Ver catálogo completo')).toBeTruthy());
    expect(screen.getByText('Ver catálogo completo')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /Ver producto$/ })).toHaveLength(6),
    );
  });

  it('aísla el scroll de Home durante el gesto y la inercia de sugerencias', async () => {
    ['silla', 'andador', 'bastón', 'muletas', 'rodillera', 'collarín'].forEach(addRecentSearch);
    await render(
      <CatalogPreviewProvider>
        <HomeScreen />
      </CatalogPreviewProvider>,
    );
    await screen.findByText('Ver catálogo completo');
    const input = screen.getByLabelText('Buscar equipo ortopédico');
    let inputAncestor = input.parent;
    let inputScrollsWithHome = false;
    while (inputAncestor) {
      if (inputAncestor.type === 'RCTScrollView') inputScrollsWithHome = true;
      inputAncestor = inputAncestor.parent;
    }
    expect(inputScrollsWithHome).toBe(true);
    await fireEvent(input, 'focus');
    const suggestions = await screen.findByLabelText('Sugerencias de búsqueda');
    // A native ScrollView ancestor would let Home intercept the suggestions' gesture.
    let ancestor = suggestions.parent;
    while (ancestor) {
      expect(ancestor.type).not.toBe('RCTScrollView');
      ancestor = ancestor.parent;
    }
    expect(screen.getByLabelText('Contenido de inicio').props.scrollEnabled).toBe(true);
    await fireEvent(suggestions, 'scrollBeginDrag');
    expect(screen.getByLabelText('Contenido de inicio').props.scrollEnabled).toBe(false);
    await fireEvent(suggestions, 'touchCancel');
    expect(screen.getByLabelText('Contenido de inicio').props.scrollEnabled).toBe(false);
    await fireEvent(suggestions, 'momentumScrollBegin');
    await fireEvent(suggestions, 'scrollEndDrag');
    expect(screen.getByLabelText('Contenido de inicio').props.scrollEnabled).toBe(false);
    await fireEvent(suggestions, 'momentumScrollEnd');
    expect(screen.getByLabelText('Contenido de inicio').props.scrollEnabled).toBe(true);
    await fireEvent(input, 'blur');
    expect(screen.queryByLabelText('Sugerencias de búsqueda')).toBeNull();
    expect(screen.getByLabelText('Contenido de inicio').props.scrollEnabled).toBe(true);
    await fireEvent(input, 'focus');
    expect(await screen.findByLabelText('Sugerencias de búsqueda')).toBeTruthy();
    await fireEvent(screen.getByLabelText('Contenido de inicio'), 'scrollBeginDrag');
    expect(screen.queryByLabelText('Sugerencias de búsqueda')).toBeNull();
  });
});
