import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';
import { render } from '../../../../tests/support/render-with-toast';
import { installNetworkMock } from '../../../../tests/support/network-mock';
import { productPage } from '../../../../tests/support/product-fixtures';
import { productService } from '@/services/products/product-service';
import { CatalogScreen } from '../CatalogScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({}),
}));

describe('Catálogo móvil público', () => {
  beforeEach(() => {
    installNetworkMock();
    jest.spyOn(productService, 'offers').mockResolvedValue({ promotions: [] });
  });

  it('carga 24, acumula la siguiente página y abre el detalle real', async () => {
    const list = jest
      .spyOn(productService, 'list')
      .mockImplementation(async (_filters, page) => productPage(page));
    await render(<CatalogScreen />);
    await screen.findByText('24 de 26 productos');
    expect(screen.queryByText('Más libertad.\nMás movimiento.')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Ver más productos'));
    await screen.findByText('26 de 26 productos');
    expect(list.mock.calls.map((call) => call[1])).toEqual([1, 2]);
    expect(screen.queryByLabelText('Ver más productos')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /Producto 1\..*Ver producto/ }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/producto/[id]',
      params: { id: '1', mode: undefined },
    });
  });

  it('conserva los productos cargados ante error en Ver más y permite reintentar', async () => {
    const list = jest
      .spyOn(productService, 'list')
      .mockResolvedValueOnce(productPage())
      .mockRejectedValueOnce(new Error('Falló la página'))
      .mockResolvedValueOnce(productPage(2));
    await render(<CatalogScreen />);
    await screen.findByText('24 de 26 productos');
    await fireEvent.press(screen.getByLabelText('Ver más productos'));
    await screen.findByText('No pudimos cargar más productos. Los anteriores siguen disponibles.');
    expect(screen.getByText('24 de 26 productos')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('26 de 26 productos');
    expect(list).toHaveBeenCalledTimes(3);
  });

  it('aplica filtros al confirmar, cancela borradores y reinicia la paginación', async () => {
    const list = jest
      .spyOn(productService, 'list')
      .mockImplementation(async (_filters, page) => productPage(page));
    await render(<CatalogScreen />);
    await screen.findByText('24 de 26 productos');
    await fireEvent.press(screen.getByLabelText('Ver más productos'));
    await screen.findByText('26 de 26 productos');
    await fireEvent.press(screen.getByLabelText('Filtrar catálogo'));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Solo disponibles' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
    expect(list).toHaveBeenCalledTimes(2);
    await fireEvent.press(screen.getByLabelText('Filtrar catálogo'));
    expect(
      screen.getByRole('checkbox', { name: 'Solo disponibles' }).props.accessibilityState.checked,
    ).toBe(false);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Solo disponibles' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Movilidad' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Renta' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(3));
    expect(list.mock.calls[2][0]).toMatchObject({
      soloDisponibles: true,
      clasificaciones: ['Movilidad'],
      tipos: ['RENTA'],
    });
    expect(list.mock.calls[2][1]).toBe(1);
    await screen.findByText('24 de 26 productos');
  });

  it('muestra skeleton, vacío y error inicial con recuperación', async () => {
    let reject!: (error: Error) => void;
    const list = jest
      .spyOn(productService, 'list')
      .mockReturnValueOnce(
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
      )
      .mockResolvedValueOnce(productPage(1, 0));
    await render(<CatalogScreen />);
    expect(screen.getByLabelText('Cargando catálogo…')).toBeTruthy();
    expect(screen.queryByText('No encontramos productos')).toBeNull();
    await act(() => reject(new Error('No pudimos cargar el catálogo')));
    await screen.findByText('No pudimos cargar el catálogo');
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('No encontramos productos');
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('pausa las consultas al iniciar offline', async () => {
    installNetworkMock({ isInternetReachable: false });
    const list = jest.spyOn(productService, 'list').mockResolvedValue(productPage());
    onlineManager.setOnline(false);
    try {
      await render(<CatalogScreen />);
      await screen.findByText('Sin conexión');
      expect(list).not.toHaveBeenCalled();
      await act(async () => {
        onlineManager.setOnline(true);
      });
      await screen.findByText('24 de 26 productos');
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it('busca en el backend y vuelve a la primera página', async () => {
    const list = jest
      .spyOn(productService, 'list')
      .mockImplementation(async (_filters, page) => productPage(page));
    await render(<CatalogScreen />);
    await screen.findByText('24 de 26 productos');
    await fireEvent.press(screen.getByLabelText('Ver más productos'));
    await screen.findByText('26 de 26 productos');
    await fireEvent.changeText(screen.getByLabelText('Buscar equipo ortopédico'), 'silla');
    await waitFor(() => expect(list).toHaveBeenCalledTimes(3));
    expect(list.mock.calls[2][0].search).toBe('silla');
    expect(list.mock.calls[2][1]).toBe(1);
    await screen.findByText('24 de 26 productos');
  });

  it('no repite una petición de Ver más mientras la página está pendiente', async () => {
    let resolve!: (page: ReturnType<typeof productPage>) => void;
    const list = jest
      .spyOn(productService, 'list')
      .mockResolvedValueOnce(productPage())
      .mockReturnValueOnce(
        new Promise((done) => {
          resolve = done;
        }),
      );
    await render(<CatalogScreen />);
    await screen.findByText('24 de 26 productos');
    const button = screen.getByLabelText('Ver más productos');
    await fireEvent.press(button);
    await fireEvent.press(button);
    expect(list).toHaveBeenCalledTimes(2);
    await act(() => resolve(productPage(2)));
    await screen.findByText('26 de 26 productos');
  });
});
