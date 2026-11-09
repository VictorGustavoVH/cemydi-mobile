import { Dimensions, StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { toProductCard } from '@/services/products/product-adapter';
import { productFixture } from '../../../../tests/support/product-fixtures';
import { ProductGridItem } from '../ProductGridItem';
import { ProductGridSkeleton } from '../ProductGridSkeleton';
import { ProductCard } from '../ProductCard';
import type { TestInstance } from 'test-renderer';

jest.mock('expo-image', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Image: View };
});

function nodes(node: TestInstance = screen.container): TestInstance[] {
  return [
    node,
    ...node.children.flatMap((child) => (typeof child === 'object' ? nodes(child) : [])),
  ];
}

const initialWindow = Dimensions.get('window');
const initialScreen = Dimensions.get('screen');
afterEach(() => Dimensions.set({ window: initialWindow, screen: initialScreen }));

it('conserva la modalidad y el producto al abrir la tarjeta compartida', async () => {
  const onOpen = jest.fn();
  await render(
    <ProductGridItem
      product={toProductCard(productFixture())}
      mode="rental"
      width={160}
      onOpen={onOpen}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: /Ver producto$/ }));
  expect(onOpen).toHaveBeenCalledWith('1', 'rental');
});

it('permite precios grandes sin encogerlos y mantiene 3:2 con altura máxima de 160', async () => {
  Dimensions.set({ window: { width: 320, height: 700, scale: 3, fontScale: 2 } });
  await render(
    <ProductCard
      product={{ ...toProductCard(productFixture()), price: '$1,234,567.89' }}
      onPress={jest.fn()}
    />,
  );
  const price = screen.getByText('$1,234,567.89');
  expect(price.props.adjustsFontSizeToFit).toBeUndefined();
  expect(price.props.numberOfLines).toBeUndefined();
  expect(price.props.maxFontSizeMultiplier).toBeUndefined();
  await fireEvent(screen.getByRole('button', { name: /Ver producto$/ }), 'layout', {
    nativeEvent: { layout: { width: 180, height: 400, x: 0, y: 0 } },
  });
  const photo = screen.getByLabelText('Producto 1', { includeHiddenElements: true });
  expect(photo).toHaveStyle({ width: '100%', height: 120 });
  expect(photo).toHaveProp('contentFit', 'contain');
  expect(StyleSheet.flatten(photo.props.style).opacity).toBeUndefined();
});

it('sitúa la valoración a la derecha, en la misma fila de la marca', async () => {
  await render(
    <ProductCard
      product={toProductCard(productFixture())}
      onPress={jest.fn()}
      ratingState={{
        summary: { count: 7, averageRating: 3.5 },
        isPaused: false,
        isFetching: false,
        isError: false,
      }}
    />,
  );
  const rating = screen.getByText('3.5').parent?.parent;
  const brand = screen.getByText(productFixture().marca);
  expect(rating).toHaveStyle({ alignItems: 'flex-end', marginLeft: 'auto' });
  expect(brand.parent).toBe(rating?.parent);
  expect(rating?.parent?.children.at(-1)).toBe(rating);
});

it('no reserva descuentos ausentes y permite representar receta y descuento sin altura rígida', async () => {
  Dimensions.set({ window: { width: 320, height: 700, scale: 3, fontScale: 2 } });
  const view = await render(<ProductGridSkeleton columns={2} count={3} />);
  const initialBlocks = nodes().length;
  expect(
    nodes().filter((item) => StyleSheet.flatten(item.props.style)?.aspectRatio === 1.5),
  ).toHaveLength(3);
  await view.rerender(<ProductGridSkeleton columns={2} count={3} showDiscount showPrescription />);
  expect(nodes()).toHaveLength(initialBlocks + 9);
  expect(nodes().some((item) => StyleSheet.flatten(item.props.style)?.height === 48)).toBe(true);
});
