import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';
import { render } from '../../../../tests/support/render-with-toast';
import { installNetworkMock } from '../../../../tests/support/network-mock';
import { productOfferFixture, productPage } from '../../../../tests/support/product-fixtures';
import { productService } from '@/services/products/product-service';
import { CatalogScreen } from '../CatalogScreen';

const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(callback, [callback]);
  },
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    canGoBack: () => true,
    navigate: jest.fn(),
  }),
  useLocalSearchParams: () => mockParams,
}));

describe('Catálogo móvil público', () => {
  beforeEach(() => {
    mockParams = {};
    installNetworkMock();
    jest.spyOn(productService, 'offers').mockResolvedValue({ promotions: [] });
  });

  it('aplica parámetros nuevos sin remontar la pestaña y conserva la búsqueda al regresar', async () => {
    jest.spyOn(productService, 'list').mockResolvedValue(productPage(1));
    const view = await render(<CatalogScreen />);
    await screen.findByRole('button', { name: /^Producto 1\./ });
    mockParams = { search: 'andadera', mode: 'rental', t: 'segunda-visita' };
    await view.rerender(<CatalogScreen />);
    expect(screen.getByLabelText('Buscar equipo ortopédico')).toHaveProp('value', 'andadera');
    await waitFor(() =>
      expect(productService.list).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'andadera', tipos: ['MIXTO', 'RENTA'] }),
        1,
        undefined,
        expect.any(AbortSignal),
      ),
    );
    await fireEvent.changeText(screen.getByLabelText('Buscar equipo ortopédico'), 'otra búsqueda');
    await view.rerender(<CatalogScreen />);
    expect(screen.getByLabelText('Buscar equipo ortopédico')).toHaveProp('value', 'otra búsqueda');
    await waitFor(() =>
      expect(productService.list).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'otra búsqueda' }),
        1,
        undefined,
        expect.any(AbortSignal),
      ),
    );
  });

  it('carga 24, acumula la siguiente página y abre el detalle real', async () => {
    const list = jest
      .spyOn(productService, 'list')
      .mockImplementation(async (_filters, page) => productPage(page));
    await render(<CatalogScreen />);
    await screen.findByRole('button', { name: /^Producto 1\./ });
    expect(screen.queryByText(/\d+ de \d+ productos/)).toBeNull();
    expect(screen.queryByText('Productos de compra y renta')).toBeNull();
    expect(screen.queryByText('Más libertad.\nMás movimiento.')).toBeNull();
    await fireEvent(screen.getByLabelText('Productos del catálogo'), 'endReached');
    await screen.findByText('Has visto todos los productos');
    expect(list.mock.calls.map((call) => call[1])).toEqual([1, 2]);
    expect(screen.queryByLabelText('Ver más productos')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /Producto 1\..*Ver producto/ }));
    await fireEvent.press(screen.getByRole('button', { name: /Producto 1\..*Ver producto/ }));
    await fireEvent.press(screen.getByRole('button', { name: /Producto 2\..*Ver producto/ }));
    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/producto/[id]',
      params: { id: '1', mode: undefined },
    });
  });

  it('conserva los productos cargados ante error de carga automática y permite reintentar', async () => {
    const list = jest
      .spyOn(productService, 'list')
      .mockResolvedValueOnce(productPage())
      .mockRejectedValueOnce(new Error('Falló la página'))
      .mockResolvedValueOnce(productPage(2));
    await render(<CatalogScreen />);
    await screen.findByRole('button', { name: /^Producto 1\./ });
    await fireEvent(screen.getByLabelText('Productos del catálogo'), 'endReached');
    await screen.findByText('No pudimos cargar más productos. Los anteriores siguen disponibles.');
    expect(screen.getByRole('button', { name: /^Producto 1\./ })).toBeTruthy();
    await fireEvent(screen.getByLabelText('Productos del catálogo'), 'endReached');
    expect(list).toHaveBeenCalledTimes(2);
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('Has visto todos los productos');
    expect(list).toHaveBeenCalledTimes(3);
  });

  it('aplica cada selección de inmediato, conserva cambios al cerrar y reinicia la paginación', async () => {
    const list = jest
      .spyOn(productService, 'list')
      .mockImplementation(async (_filters, page) => productPage(page));
    await render(<CatalogScreen />);
    await screen.findByRole('button', { name: /^Producto 1\./ });
    await fireEvent(screen.getByLabelText('Productos del catálogo'), 'endReached');
    await screen.findByText('Has visto todos los productos');
    await fireEvent.press(screen.getByLabelText('Filtrar catálogo'));
    const applyButton = screen.getByRole('button', { name: 'Aplicar filtros' });
    let ancestor = applyButton.parent;
    while (ancestor) {
      expect(ancestor.type).not.toBe('RCTScrollView');
      ancestor = ancestor.parent;
    }
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Solo disponibles' }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(3));
    expect(list.mock.calls[2][0].soloDisponibles).toBe(true);
    expect(list.mock.calls[2][1]).toBe(1);
    expect(screen.getByRole('button', { name: 'Aplicar filtros' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Producto 26\./ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
    expect(list).toHaveBeenCalledTimes(3);
    await fireEvent.press(screen.getByLabelText('Filtrar catálogo'));
    expect(
      screen.getByRole('checkbox', { name: 'Solo disponibles' }).props.accessibilityState.checked,
    ).toBe(true);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Movilidad' }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(4));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Renta' }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(5));
    expect(list.mock.calls[4][0]).toMatchObject({
      soloDisponibles: true,
      clasificaciones: ['Movilidad'],
      tipos: ['RENTA'],
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Aplicar filtros' }));
    expect(list).toHaveBeenCalledTimes(5);
    expect(screen.queryByRole('button', { name: 'Aplicar filtros' })).toBeNull();
    await screen.findByRole('button', { name: /^Producto 1\./ });
  });

  it('combina filtros rápidos con la búsqueda, incluye MIXTO y permite volver a Todos', async () => {
    const list = jest.spyOn(productService, 'list').mockResolvedValue(productPage());
    await render(<CatalogScreen />);
    await screen.findByRole('button', { name: /^Producto 1\./ });
    expect(screen.getByLabelText('Filtros rápidos; desliza para ver más').props.horizontal).toBe(
      true,
    );
    await fireEvent.changeText(screen.getByLabelText('Buscar equipo ortopédico'), 'silla');
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await fireEvent.press(screen.getByRole('radio', { name: 'Compra' }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(3));
    expect(list.mock.calls[2][0]).toMatchObject({ search: 'silla', tipos: ['MIXTO', 'VENTA'] });
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Disponibles' }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(4));
    expect(list.mock.calls[3][0].soloDisponibles).toBe(true);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Menor precio' }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(5));
    expect(list.mock.calls[4][0]).toMatchObject({
      search: 'silla',
      tipos: ['MIXTO', 'VENTA'],
      soloDisponibles: true,
      sort: 'precio-asc',
    });
    await fireEvent.press(screen.getByRole('radio', { name: 'Renta' }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(6));
    expect(list.mock.calls[5][0].tipos).toEqual(['MIXTO', 'RENTA']);
    expect(screen.getByRole('radio', { name: 'Renta' }).props.accessibilityState.checked).toBe(
      true,
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Todos' }));
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Todos' }).props.accessibilityState.checked).toBe(
        true,
      ),
    );
    expect(screen.getByLabelText('Buscar equipo ortopédico').props.value).toBe('silla');
    expect(
      screen.getByRole('checkbox', { name: 'Disponibles' }).props.accessibilityState.checked,
    ).toBe(false);
    expect(
      screen.getByRole('checkbox', { name: 'Menor precio' }).props.accessibilityState.checked,
    ).toBe(false);
    // Returning to a cached selection need not issue another request.
    expect(screen.queryByRole('button', { name: 'Aplicar filtros' })).toBeNull();
  });

  it('retira opciones obsoletas durante la carga y restaura las opciones recibidas', async () => {
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
    await screen.findByRole('button', { name: /^Producto 1\./ });
    await fireEvent.press(screen.getByLabelText('Filtrar catálogo'));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Movilidad' }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('checkbox', { name: 'Movilidad' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Marca de prueba' })).toBeNull();
    expect(screen.getAllByText('Las opciones aparecerán al cargar el catálogo.')[0]).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Aplicar filtros' })).toBeTruthy();
    await act(() => resolve(productPage()));
    await fireEvent.press(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(
      screen.getByRole('checkbox', { name: 'Movilidad' }).props.accessibilityState.checked,
    ).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Aplicar filtros' }));
    expect(screen.getByRole('radio', { name: 'Todos' }).props.accessibilityState.checked).toBe(
      true,
    );
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
    await screen.findByText('Ocurrió un error. Intenta de nuevo.');
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
      await screen.findByRole('button', { name: /^Producto 1\./ });
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it('busca en el backend y vuelve a la primera página', async () => {
    const list = jest
      .spyOn(productService, 'list')
      .mockImplementation(async (_filters, page) => productPage(page));
    await render(<CatalogScreen />);
    await screen.findByRole('button', { name: /^Producto 1\./ });
    await fireEvent(screen.getByLabelText('Productos del catálogo'), 'endReached');
    await screen.findByText('Has visto todos los productos');
    await fireEvent.changeText(screen.getByLabelText('Buscar equipo ortopédico'), 'silla');
    await waitFor(() => expect(list).toHaveBeenCalledTimes(3));
    expect(list.mock.calls[2][0].search).toBe('silla');
    expect(list.mock.calls[2][1]).toBe(1);
    await screen.findByRole('button', { name: /^Producto 1\./ });
  });

  it('no repite una petición al llegar al final mientras la página está pendiente', async () => {
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
    await screen.findByRole('button', { name: /^Producto 1\./ });
    const listView = screen.getByLabelText('Productos del catálogo');
    await fireEvent(listView, 'endReached');
    await fireEvent(listView, 'endReached');
    expect(list).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Cargando más productos…')).toBeTruthy();
    await act(() => resolve(productPage(2)));
    await screen.findByText('Has visto todos los productos');
  });

  it('mantiene el scroll del catálogo quieto durante arrastre e inercia de sugerencias', async () => {
    jest
      .spyOn(productService, 'list')
      .mockImplementation(async (_filters, page, pageSize) =>
        productPage(page, pageSize === 10 ? 10 : 26),
      );
    await render(<CatalogScreen />);
    await screen.findByRole('button', { name: /^Producto 1\./ });
    const input = screen.getByLabelText('Buscar equipo ortopédico');
    await fireEvent.changeText(input, 'a');
    await fireEvent(input, 'focus');
    const suggestions = await screen.findByLabelText('Sugerencias de búsqueda');
    let ancestor = suggestions.parent;
    while (ancestor) {
      expect(ancestor.type).not.toBe('RCTScrollView');
      ancestor = ancestor.parent;
    }
    let inputAncestor = input.parent;
    let inputScrollsWithCatalog = false;
    while (inputAncestor) {
      if (inputAncestor.type === 'RCTScrollView') inputScrollsWithCatalog = true;
      inputAncestor = inputAncestor.parent;
    }
    expect(inputScrollsWithCatalog).toBe(true);
    expect(screen.getByLabelText('Productos del catálogo').props.scrollEnabled).toBe(true);
    await fireEvent(suggestions, 'scrollBeginDrag');
    expect(screen.getByLabelText('Productos del catálogo').props.scrollEnabled).toBe(false);
    await fireEvent(suggestions, 'touchCancel');
    expect(screen.getByLabelText('Productos del catálogo').props.scrollEnabled).toBe(false);
    await fireEvent(suggestions, 'momentumScrollBegin');
    await fireEvent(suggestions, 'scrollEndDrag');
    expect(screen.getByLabelText('Productos del catálogo').props.scrollEnabled).toBe(false);
    await fireEvent(suggestions, 'momentumScrollEnd');
    expect(screen.getByLabelText('Productos del catálogo').props.scrollEnabled).toBe(true);
    await fireEvent(input, 'blur');
    expect(screen.queryByLabelText('Sugerencias de búsqueda')).toBeNull();
    await fireEvent(input, 'focus');
    expect(await screen.findByLabelText('Sugerencias de búsqueda')).toBeTruthy();
    await fireEvent(screen.getByLabelText('Productos del catálogo'), 'scrollBeginDrag');
    expect(screen.queryByLabelText('Sugerencias de búsqueda')).toBeNull();
  });

  it('espera las ofertas antes de pintar precios para no cambiar el alto de las tarjetas', async () => {
    let resolveOffers!: (value: Awaited<ReturnType<typeof productService.offers>>) => void;
    jest.spyOn(productService, 'offers').mockReturnValue(
      new Promise((done) => {
        resolveOffers = done;
      }),
    );
    jest.spyOn(productService, 'list').mockResolvedValue(productPage(1, 1));
    await render(<CatalogScreen />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    // La lista ya respondió, pero la tarjeta todavía no debe mostrarse: al
    // aplicar la oferta gana precio tachado y descuento, y con ellos alto.
    expect(productService.list).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Cargando catálogo…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Producto 1\./ })).toBeNull();
    expect(screen.queryByText('No encontramos productos')).toBeNull();
    await act(() => resolveOffers({ promotions: [productOfferFixture(1)] }));
    expect(await screen.findByRole('button', { name: /^Producto 1\./ })).toBeTruthy();
    expect(screen.getByText('-25%')).toBeTruthy();
  });

  it('no ancla la lista al hacer scroll', async () => {
    jest.spyOn(productService, 'list').mockResolvedValue(productPage(1, 2));
    await render(<CatalogScreen />);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /^Producto \d\./ }).length).toBeGreaterThan(0),
    );
    const list = screen.getByLabelText('Productos del catálogo');
    // La lista no compensa cambios de alto: las pestañas conservan la instancia
    // y las alturas de cabecera/tarjetas se estabilizan en su origen.
    expect(list.props.maintainVisibleContentPosition).toBeUndefined();
    await fireEvent.scroll(list, { nativeEvent: { contentOffset: { y: 320 } } });
    expect(list.props.maintainVisibleContentPosition).toBeUndefined();
  });
});
