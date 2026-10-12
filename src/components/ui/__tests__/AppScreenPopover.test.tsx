import { useEffect, useRef } from 'react';
import { Keyboard, Platform, ScrollView, Text, View } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { render } from '../../../../tests/support/render-with-toast';
import { AppScreen, useScreenOverlay } from '../AppScreen';
import { AppScreenPopover } from '../AppScreenPopover';

function SearchFixture({ visible = true }: { visible?: boolean }) {
  const anchor = useRef<View>(null);
  const viewport = useScreenOverlay()?.viewport;
  useEffect(() => {
    if (anchor.current && viewport?.current) {
      const anchorView = anchor.current;
      const viewportView = viewport.current;
      const anchorMeasure = anchorView.measureInWindow;
      const viewportMeasure = viewportView.measureInWindow;
      // RN's Jest preset shares one method mock; give each view its own measurement.
      Object.defineProperty(anchorView, 'measureInWindow', {
        configurable: true,
        value: (callback: Parameters<View['measureInWindow']>[0]) => callback(20, 140, 350, 48),
      });
      Object.defineProperty(viewportView, 'measureInWindow', {
        configurable: true,
        value: (callback: Parameters<View['measureInWindow']>[0]) => callback(0, 44, 390, 700),
      });
      return () => {
        Object.defineProperty(anchorView, 'measureInWindow', { value: anchorMeasure });
        Object.defineProperty(viewportView, 'measureInWindow', { value: viewportMeasure });
      };
    }
  }, [viewport]);
  return (
    <ScrollView>
      <View ref={anchor} testID="search-anchor">
        <Text>Buscador</Text>
      </View>
      {visible ? (
        <AppScreenPopover anchor={anchor}>
          <ScrollView accessibilityLabel="Sugerencias">
            <Text>Producto</Text>
          </ScrollView>
        </AppScreenPopover>
      ) : null}
    </ScrollView>
  );
}

describe('Desplegable anclado a AppScreen', () => {
  it('dibuja debajo del input, fuera de la lista y dentro del espacio sobre el teclado', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    jest
      .spyOn(Keyboard, 'metrics')
      .mockReturnValue({ screenX: 0, screenY: 500, width: 390, height: 300 });
    await render(
      <AppScreen>
        <SearchFixture />
      </AppScreen>,
    );
    await fireEvent(screen.getByTestId('screen-overlay-host'), 'layout');
    const suggestions = screen.getByLabelText('Sugerencias');
    let ancestor = suggestions.parent;
    let position: unknown;
    while (ancestor) {
      expect(ancestor.type).not.toBe('RCTScrollView');
      if (ancestor.props.style?.position === 'absolute') position = ancestor.props.style;
      ancestor = ancestor.parent;
    }
    expect(position).toMatchObject({ left: 20, top: 148, width: 350, maxHeight: 300, opacity: 1 });
    expect(screen.container.queryAll((node) => node.type.includes('Modal'))).toHaveLength(0);
  });

  it('retira la capa al cerrar las sugerencias y permite volver a abrirla', async () => {
    const view = await render(
      <AppScreen>
        <SearchFixture />
      </AppScreen>,
    );
    expect(screen.getByText('Producto')).toBeTruthy();
    await view.rerender(
      <AppScreen>
        <SearchFixture visible={false} />
      </AppScreen>,
    );
    expect(screen.queryByText('Producto')).toBeNull();
    await view.rerender(
      <AppScreen>
        <SearchFixture />
      </AppScreen>,
    );
    expect(screen.getByText('Producto')).toBeTruthy();
  });
});
