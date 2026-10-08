import { fireEvent, render, screen } from '@testing-library/react-native';
import { productFixture } from '../../../../tests/support/product-fixtures';
import { toProductCard } from '@/services/products/product-adapter';
import { ProductCard } from '../ProductCard';

describe('ProductCard', () => {
  it.each([
    ['VENTA', 'Venta'],
    ['RENTA', 'Renta'],
    ['MIXTO', 'Venta y renta'],
  ] as const)(
    'identifica la modalidad %s visualmente y en su etiqueta accesible',
    async (tipo, label) => {
      await render(
        <ProductCard
          product={toProductCard(productFixture(1, { tipoAdquisicion: tipo, stock: 0 }))}
          onPress={jest.fn()}
        />,
      );
      expect(screen.getByText(label)).toBeTruthy();
      expect(screen.getByRole('button', { name: new RegExp(`${label}\\.`) })).toBeTruthy();
    },
  );
  it('conserva ambas modalidades al mostrar la tarifa de renta de un producto mixto', async () => {
    await render(
      <ProductCard product={toProductCard(productFixture(), [], 'rental')} onPress={jest.fn()} />,
    );
    expect(screen.getByText('Venta y renta')).toBeTruthy();
    expect(screen.getByText('Precio de renta')).toBeTruthy();
    expect(screen.getByText('$60.00')).toBeTruthy();
    expect(screen.getByText('/ día')).toBeTruthy();
  });
  it('permite consultar un agotado y lo identifica por texto', async () => {
    const onPress = jest.fn();
    await render(
      <ProductCard product={toProductCard(productFixture(1, { stock: 0 }))} onPress={onPress} />,
    );
    expect(screen.getByText('No disponible')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /No disponible.*Ver producto/ }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('muestra precio original, descuento y precio del servidor', async () => {
    const product = {
      ...toProductCard(productFixture()),
      originalPrice: '$1,200.00',
      price: '$999.99',
      discountPercent: 15,
    };
    await render(<ProductCard product={product} onPress={jest.fn()} />);
    expect(screen.getByText('$1,200.00')).toBeTruthy();
    expect(screen.getByText('$999.99')).toBeTruthy();
    expect(screen.getByText('Oferta · 15%')).toBeTruthy();
  });
  it('muestra fallback cuando el producto no tiene foto', async () => {
    await render(
      <ProductCard
        product={toProductCard(productFixture(1, { imageUrl: null }))}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByText('Imagen no disponible')).toBeTruthy();
  });
});
