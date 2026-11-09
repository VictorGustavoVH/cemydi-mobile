import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import ProductDetailRoute from '@/app/producto/[id]';
import { ConnectedProductDetailScreen } from '../ConnectedProductDetailScreen';
import { ProductDetailScreen } from '../ProductDetailScreen';

let mockId = '1';
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: mockId }),
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock('../ConnectedProductDetailScreen', () => ({ ConnectedProductDetailScreen: jest.fn() }));
jest.mock('../ProductDetailScreen', () => ({ ProductDetailScreen: jest.fn() }));
beforeEach(() => {
  jest
    .mocked(ConnectedProductDetailScreen)
    .mockImplementation(({ productId }: ComponentProps<typeof ConnectedProductDetailScreen>) => (
      <Text>API {productId}</Text>
    ));
  jest.mocked(ProductDetailScreen).mockImplementation(() => <Text>Producto no encontrado</Text>);
});

it.each(['wheelchair', 'bed', '0', '-1', '../producto', '9007199254740992'])(
  'rechaza %s sin resolver fixtures o consultar la API',
  async (id) => {
    mockId = id;
    await render(<ProductDetailRoute />);
    expect(screen.getByText('Producto no encontrado')).toBeTruthy();
    expect(ConnectedProductDetailScreen).not.toHaveBeenCalled();
    expect(ProductDetailScreen).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('Volver al catálogo'));
    expect(mockReplace).toHaveBeenCalledWith('/catalogo');
  },
);
it('dirige un identificador válido al detalle conectado', async () => {
  mockId = '101';
  await render(<ProductDetailRoute />);
  expect(screen.getByText('API 101')).toBeTruthy();
  expect(ProductDetailScreen).not.toHaveBeenCalled();
});
it('rechaza slugs de muestra también en producción y sin montar pantallas de detalle', async () => {
  const previous = __DEV__;
  Object.assign(globalThis, { __DEV__: false });
  try {
    mockId = 'hospital-bed';
    await render(<ProductDetailRoute />);
    expect(screen.getByText('Producto no encontrado')).toBeTruthy();
    expect(ProductDetailScreen).not.toHaveBeenCalled();
    expect(ConnectedProductDetailScreen).not.toHaveBeenCalled();
  } finally {
    Object.assign(globalThis, { __DEV__: previous });
  }
});
