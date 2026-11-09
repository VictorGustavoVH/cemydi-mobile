/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { addRecentSearch, clearRecentSearches } from '@/hooks/useRecentSearches';
import { render } from '../../../../tests/support/render-with-toast';

import { HomeScreen } from '../HomeScreen';
import { Platform } from 'react-native';
import { homeService } from '../services/homeService.api';
import { CatalogPreviewProvider } from '../../../../tests/support/catalog-cart-provider';
import { productService } from '@/services/products/product-service';
import { installHomePreviewApiMock } from '../../../../tests/support/home-preview-api-mock';

const mockRouter = {
  back: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  navigate: jest.fn(),
  setParams: jest.fn(),
};
jest.mock('react-native/Libraries/Components/RefreshControl/RefreshControl', () =>
  jest.requireActual('react-native/Libraries/Components/RefreshControl/RefreshControl'),
);

jest.mock('expo-router', () => {
  const { useEffect } = require('react');

  return {
    useFocusEffect: (callback: () => void | (() => void)) => useEffect(callback, [callback]),
    useRouter: () => mockRouter,
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
  it.each([
    ['Movilidad', 'Movilidad'],
    ['Descanso', 'Cuidado en cama'],
    ['Soportes', 'Soporte'],
    ['Apoyo', 'Apoyo para caminar'],
  ])(
    'conserva la categoría editorial %s y navega usando su clasificación exacta',
    async (label, clasificacion) => {
      await render(
        <CatalogPreviewProvider>
          <HomeScreen />
        </CatalogPreviewProvider>,
      );
      await fireEvent.press(screen.getByRole('button', { name: label }));
      expect(mockRouter.navigate).toHaveBeenCalledWith({
        pathname: '/catalogo',
        params: { clasificacion, t: expect.any(String) },
      });
      for (const category of ['Movilidad', 'Descanso', 'Soportes', 'Apoyo'])
        expect(screen.getByRole('button', { name: category })).toBeTruthy();
    },
  );
  it('el gesto nativo de Android consulta de nuevo y mantiene el indicador hasta terminar', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const view = await render(
      <CatalogPreviewProvider>
        <HomeScreen />
      </CatalogPreviewProvider>,
    );
    await screen.findByText('Ver catálogo completo');
    const initial = await jest.mocked(homeService.getHome).mock.results[0].value;
    let finish!: (value: typeof initial) => void;
    jest.mocked(homeService.getHome).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const control = () =>
      view.container.queryAll((node) =>
        ['AndroidSwipeRefreshLayout', 'RCTRefreshControl'].includes(node.type),
      )[0];
    expect(control()).toBeTruthy();
    expect(control().props.refreshing).toBe(false);
    await fireEvent(control(), 'refresh');
    await waitFor(() => expect(homeService.getHome).toHaveBeenCalledTimes(2));
    expect(control().props.refreshing).toBe(true);
    await act(async () => finish(initial));
    await waitFor(() => expect(control().props.refreshing).toBe(false));
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
  it('permite desplegar preguntas frecuentes al final de Inicio y abrir ayuda', async () => {
    await render(
      <CatalogPreviewProvider>
        <HomeScreen />
      </CatalogPreviewProvider>,
    );
    expect(screen.getByRole('header', { name: 'Preguntas frecuentes' })).toBeTruthy();
    expect(screen.queryByText(/En Perfil, abre Mis rentas y selecciona/)).toBeNull();
    const question = screen.getByRole('button', { name: '¿Dónde consulto mis rentas?' });
    await fireEvent.press(question);
    expect(screen.getByText(/En Perfil, abre Mis rentas y selecciona/)).toBeTruthy();
    expect(question).toHaveProp('accessibilityState', expect.objectContaining({ expanded: true }));
    await fireEvent.press(question);
    expect(screen.queryByText(/En Perfil, abre Mis rentas y selecciona/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Ayuda y contacto' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/perfil/ayuda');
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
