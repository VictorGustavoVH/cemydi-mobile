import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { render } from '../../../../tests/support/render-with-toast';
import { Share } from 'react-native';
import { CatalogPreviewProvider } from '../../../../tests/support/catalog-cart-provider';
import { CartPreviewScreen } from '@/features/cart/CartPreviewScreen';
import { PreviewProductDetailScreen as ProductDetailScreen } from '../../../../tests/support/PreviewProductDetailScreen';
import * as preview from '@/data/product-detail-preview';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    canGoBack: () => true,
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
  }),
}));

describe('Detalle de producto de muestra', () => {
  it('elige unidades independientes para compra y renta y expone pestañas seleccionadas', async () => {
    await render(
      <CatalogPreviewProvider>
        <ProductDetailScreen productId="wheelchair" />
      </CatalogPreviewProvider>,
    );
    await fireEvent.press(screen.getByLabelText('Aumentar cantidad para agregar'));
    await fireEvent.press(screen.getByLabelText('Aumentar cantidad para agregar'));
    expect(screen.getByLabelText('Cantidad para agregar: 3')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Añadir 3 al carrito'));
    expect(screen.getByLabelText('Ver carrito (3)')).toBeTruthy();
    expect(screen.getByText('Producto agregado')).toBeTruthy();
    expect(screen.queryByText(/Todas se rentan para el mismo periodo/)).toBeNull();
    await fireEvent.press(screen.getByRole('tab', { name: 'Renta' }));
    expect(screen.getByLabelText('Cantidad para agregar: 1')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Aumentar cantidad para agregar'));
    await fireEvent.press(screen.getByLabelText('Añadir 2 al carrito'));
    expect(screen.getByLabelText('Ver carrito (5)')).toBeTruthy();
    expect(
      screen.getByText(
        'Añadiste 2 unidades. Todas se rentan para el mismo periodo. Configura las fechas en el carrito.',
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Características' }));
    expect(screen.getByRole('tab', { name: 'Características' })).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
  });
  it('muestra solo fotos reales y permite seleccionar y ampliar una galería de varias imágenes', async () => {
    const product = preview.getProductPreview('wheelchair')!;
    const view = await render(
      <CatalogPreviewProvider>
        <ProductDetailScreen productId="wheelchair" />
      </CatalogPreviewProvider>,
    );
    expect(screen.getByLabelText('Ver foto 1')).toBeTruthy();
    expect(screen.queryByLabelText('Ver foto 2')).toBeNull();
    jest.spyOn(preview, 'getProductPreview').mockReturnValue({
      ...product,
      images: [
        { id: 'front', source: product.image },
        { id: 'side', source: { uri: 'https://images.test/wheelchair-side.png' } },
      ],
    });
    await view.rerender(
      <CatalogPreviewProvider>
        <ProductDetailScreen key="gallery" productId="wheelchair" />
      </CatalogPreviewProvider>,
    );
    await fireEvent.press(screen.getByLabelText('Ver foto 2'));
    expect(screen.getByLabelText('Ver foto 2')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
    await fireEvent.press(screen.getByLabelText('Ampliar foto 2 de Silla de ruedas'));
    expect(screen.getAllByLabelText('Cerrar vista ampliada').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getAllByLabelText('Cerrar vista ampliada')[0]);
    expect(screen.queryByLabelText('Silla de ruedas, foto ampliada')).toBeNull();
  });
  it('separa compra y renta en el carrito y mantiene favoritos al volver al detalle', async () => {
    const view = await render(
      <CatalogPreviewProvider>
        <ProductDetailScreen productId="wheelchair" />
      </CatalogPreviewProvider>,
    );
    await fireEvent.press(screen.getByLabelText('Guardar en favoritos'));
    await fireEvent.press(screen.getByLabelText('Añadir al carrito'));
    expect(screen.getByText('Producto agregado')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Renta'));
    expect(screen.getByText('$45')).toBeTruthy();
    expect(screen.getByText('Antes de rentar')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Añadir renta al carrito'));
    expect(screen.getByText('Producto agregado')).toBeTruthy();
    expect(screen.queryByText(/Todas se rentan para el mismo periodo/)).toBeNull();
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
    // Undo remains usable after leaving the cart because the toast and session are global.
    await fireEvent.press(screen.getByLabelText('Deshacer eliminación del producto'));
    expect(screen.getByText('Producto restaurado')).toBeTruthy();
    await view.rerender(
      <CatalogPreviewProvider>
        <CartPreviewScreen />
      </CatalogPreviewProvider>,
    );
    expect(screen.getByLabelText('Cantidad de Silla de ruedas, compra: 1')).toBeTruthy();
    expect(screen.getByLabelText('Cantidad de Silla de ruedas, renta: 1')).toBeTruthy();
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
