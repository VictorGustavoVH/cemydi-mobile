/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { addRecentSearch, clearRecentSearches } from '@/hooks/useRecentSearches';
import { render } from '../../../../tests/support/render-with-toast';

import { HomeScreen } from '../HomeScreen';
import { CatalogPreviewProvider } from '@/providers/catalog-preview-provider';
import { productService } from '@/services/products/product-service';
import { installHomePreviewApiMock } from '../../../../tests/support/home-preview-api-mock';

jest.mock('expo-router', () => {
  const { useEffect } = require('react');

  return {
    useFocusEffect: (callback: () => void | (() => void)) => useEffect(callback, [callback]),
    useRouter: () => ({
      back: jest.fn(),
      push: jest.fn(),
      replace: jest.fn(),
      navigate: jest.fn(),
      setParams: jest.fn(),
    }),
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

  it('espera las ofertas antes de pintar las tarjetas', async () => {
    let resolveOffers!: (value: Awaited<ReturnType<typeof productService.offers>>) => void;
    jest.spyOn(productService, 'offers').mockReturnValue(
      new Promise((done) => {
        resolveOffers = done;
      }),
    );
    await render(
      <CatalogPreviewProvider>
        <HomeScreen />
      </CatalogPreviewProvider>,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByLabelText('Cargando catálogo…')).toBeTruthy();
    expect(screen.queryAllByRole('button', { name: /Ver producto$/ })).toHaveLength(0);
    await act(() => resolveOffers({ promotions: [] }));
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /Ver producto$/ })).toHaveLength(6),
    );
  });

  it('no ancla la lista al hacer scroll', async () => {
    await render(
      <CatalogPreviewProvider>
        <HomeScreen />
      </CatalogPreviewProvider>,
    );
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /Ver producto$/ })).toHaveLength(6),
    );
    const list = screen.getByLabelText('Contenido de inicio');
    // La lista no compensa cambios de alto: las pestañas conservan la instancia
    // y las alturas de cabecera/tarjetas se estabilizan en su origen.
    expect(list.props.maintainVisibleContentPosition).toBeUndefined();
    await fireEvent.scroll(list, { nativeEvent: { contentOffset: { y: 320 } } });
    expect(list.props.maintainVisibleContentPosition).toBeUndefined();
  });
});
