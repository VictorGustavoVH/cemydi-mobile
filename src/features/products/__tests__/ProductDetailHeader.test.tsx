import { fireEvent, render, screen } from '@testing-library/react-native';
import { ProductDetailHeader } from '../components/ProductDetailHeader';
import { Share } from 'react-native';

const mockToggle = jest.fn();
let mockPending = false;
let mockFavorite = false;
jest.mock('@/features/favorites/hooks/useFavorites', () => ({
  useFavorites: () => ({
    isPendingToggle: mockPending,
    isFavorite: () => mockFavorite,
    toggleFavorite: mockToggle,
  }),
}));
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { id: 7 } }) }));
jest.mock('@/providers/catalog-preview-provider', () => ({
  useCatalogPreview: () => ({ favorites: [] }),
}));
jest.mock('@/hooks/useToast', () => ({ useToast: () => ({ info: jest.fn(), error: jest.fn() }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ canGoBack: () => true, back: jest.fn() }) }));

it('bloquea favoritos mientras guarda y mantiene la selección conocida', async () => {
  const view = await render(<ProductDetailHeader productId="1" fallbackHref="/catalogo" />);
  await fireEvent.press(screen.getByLabelText('Guardar en favoritos'));
  expect(mockToggle).toHaveBeenCalledWith('1');
  mockFavorite = true;
  await view.rerender(<ProductDetailHeader productId="1" fallbackHref="/catalogo" />);
  expect(screen.getByLabelText('Quitar de favoritos')).toBeEnabled();
  await fireEvent.press(screen.getByLabelText('Quitar de favoritos'));
  expect(mockToggle).toHaveBeenCalledWith('1');
  mockPending = true;
  await view.rerender(<ProductDetailHeader productId="1" fallbackHref="/catalogo" />);
  expect(screen.getByLabelText('Quitar de favoritos')).toBeDisabled();
});

it('comparte el enlace HTTPS confirmado junto con el nombre del producto', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  await render(
    <ProductDetailHeader
      productId="1"
      productName="Silla de ruedas"
      productSlug="silla-de-ruedas"
      fallbackHref="/catalogo"
    />,
  );
  await fireEvent.press(screen.getByLabelText('Compartir producto'));
  expect(share).toHaveBeenCalledWith({
    title: 'Silla de ruedas',
    message:
      'Silla de ruedas · CEMYDI\nhttps://ortopedia-cemydi.netlify.app/producto/silla-de-ruedas',
  });
});

it('impide compartir un slug que intente introducir un dominio ajeno', async () => {
  const share = jest.spyOn(Share, 'share');
  await render(
    <ProductDetailHeader
      productId="1"
      productName="Silla"
      productSlug="https://evil.example"
      fallbackHref="/catalogo"
    />,
  );
  expect(screen.getByLabelText('Compartir producto')).toBeDisabled();
  await fireEvent.press(screen.getByLabelText('Compartir producto'));
  expect(share).not.toHaveBeenCalled();
});
