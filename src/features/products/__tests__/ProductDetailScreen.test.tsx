import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';
import { CatalogPreviewProvider } from '@/providers/catalog-preview-provider';
import { CartPreviewScreen } from '@/features/cart/CartPreviewScreen';
import { ProductDetailScreen } from '../ProductDetailScreen';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    canGoBack: () => true,
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

describe('Detalle de producto de muestra', () => {
  it('separa compra y renta en el carrito y mantiene favoritos al volver al detalle', async () => {
    const view = await render(
      <CatalogPreviewProvider>
        <ProductDetailScreen productId="wheelchair" />
      </CatalogPreviewProvider>,
    );
    await fireEvent.press(screen.getByLabelText('Guardar en favoritos'));
    await fireEvent.press(screen.getByLabelText('Añadir al carrito'));
    await fireEvent.press(screen.getByLabelText('Renta'));
    expect(screen.getByText('$45')).toBeTruthy();
    expect(screen.getByText('Antes de rentar')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Añadir renta al carrito'));
    await view.rerender(
      <CatalogPreviewProvider>
        <CartPreviewScreen />
      </CatalogPreviewProvider>,
    );
    expect(screen.getByLabelText('Cantidad de Silla de ruedas, compra: 1')).toBeTruthy();
    expect(screen.getByLabelText('Cantidad de Silla de ruedas, renta: 1')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Eliminar Silla de ruedas, compra'));
    expect(screen.queryByLabelText('Cantidad de Silla de ruedas, compra: 1')).toBeNull();
    expect(screen.getByLabelText('Cantidad de Silla de ruedas, renta: 1')).toBeTruthy();
    await view.rerender(
      <CatalogPreviewProvider>
        <ProductDetailScreen productId="wheelchair" />
      </CatalogPreviewProvider>,
    );
    expect(screen.getByLabelText('Quitar de favoritos')).toBeTruthy();
  });

  it('respeta el modo inicial y muestra características y receta para la renta', async () => {
    const view = await render(
      <CatalogPreviewProvider>
        <ProductDetailScreen productId="wheelchair" initialMode="rental" />
      </CatalogPreviewProvider>,
    );
    expect(screen.getByText('$45')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Características'));
    expect(screen.getByText('Reposabrazos y reposapiés')).toBeTruthy();
    await view.rerender(
      <CatalogPreviewProvider>
        <ProductDetailScreen key="oxygen" productId="oxygen" />
      </CatalogPreviewProvider>,
    );
    expect(screen.getByText('Requiere receta. Se adjunta desde el carrito.')).toBeTruthy();
    expect(screen.queryByLabelText('Compra')).toBeNull();
    expect(screen.getByText('Todavía no hay reseñas')).toBeTruthy();
  });

  it('maneja errores de compartir sin perder la ficha', async () => {
    const share = jest.spyOn(Share, 'share').mockRejectedValueOnce(new Error('unavailable'));
    await render(
      <CatalogPreviewProvider>
        <ProductDetailScreen productId="brace" />
      </CatalogPreviewProvider>,
    );
    await fireEvent.press(screen.getByLabelText('Compartir producto'));
    await waitFor(() =>
      expect(screen.getByText('No se pudo compartir. Inténtalo de nuevo.')).toBeTruthy(),
    );
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: 'Rodillera ajustable' }));
    share.mockRestore();
  });

  it('muestra recuperación para un producto inexistente', async () => {
    await render(
      <CatalogPreviewProvider>
        <ProductDetailScreen productId="missing" />
      </CatalogPreviewProvider>,
    );
    expect(screen.getByText('Producto no encontrado')).toBeTruthy();
    expect(screen.getByLabelText('Volver al catálogo')).toBeTruthy();
  });
});
