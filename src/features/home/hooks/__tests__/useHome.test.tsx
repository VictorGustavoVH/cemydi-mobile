import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { QueryClient, onlineManager } from '@tanstack/react-query';

import { useHome } from '../useHome';
import { QueryTestProvider } from '../../../../../tests/support/query-wrapper';
import { productFixture } from '../../../../../tests/support/product-fixtures';
import { productDetailKey } from '@/services/products/product-cache';
import { homeService } from '../../services/homeService.api';
import { installHomePreviewApiMock } from '../../../../../tests/support/home-preview-api-mock';

function CatalogConsumer() {
  const query = useHome();
  return <Text>{query.data ? 'Catálogo listo' : 'Cargando'}</Text>;
}

describe('useHome', () => {
  beforeEach(installHomePreviewApiMock);
  it('conserva el resultado en caché al desmontar y volver al catálogo', async () => {
    const service = jest.spyOn(homeService, 'getHome');
    const view = await render(<CatalogConsumer />, { wrapper: QueryTestProvider });
    await screen.findByText('Catálogo listo');
    await view.rerender(<Text>Otra pantalla</Text>);
    await view.rerender(<CatalogConsumer />);
    expect(screen.getByText('Catálogo listo')).toBeTruthy();
    expect(service).toHaveBeenCalledTimes(1);
    await view.unmount();
  });

  it('comparte una carga entre dos consumidores simultáneos', async () => {
    const service = jest.spyOn(homeService, 'getHome');
    const { result, unmount } = await renderHook(
      () => {
        const first = useHome();
        const second = useHome();
        return { first, second };
      },
      { wrapper: QueryTestProvider },
    );
    await waitFor(() => expect(result.current.first.data).not.toBeNull());
    expect(result.current.second.data).toBe(result.current.first.data);
    expect(service).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it('pausa la carga inicial sin conexión y la recupera al volver online', async () => {
    onlineManager.setOnline(false);
    try {
      const { result, unmount } = await renderHook(useHome, { wrapper: QueryTestProvider });
      expect(result.current.data).toBeNull();
      expect(homeService.getHome).not.toHaveBeenCalled();
      await act(async () => {
        onlineManager.setOnline(true);
      });
      await waitFor(() => expect(result.current.data?.products.length).toBeGreaterThan(0));
      expect(fetch).not.toHaveBeenCalled();
      await unmount();
    } finally {
      onlineManager.setOnline(true);
    }
  });
  it('expone los datos del servicio una vez resuelto', async () => {
    const { result } = await renderHook(() => useHome(), { wrapper: QueryTestProvider });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.categories.length).toBeGreaterThan(0);
    expect(result.current.data?.banners.length).toBeGreaterThan(0);
    expect(result.current.data?.products.length).toBeGreaterThan(0);
  });

  it('refetch vuelve a cargar los datos', async () => {
    const { result } = await renderHook(() => useHome(), { wrapper: QueryTestProvider });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.data?.products.length).toBeGreaterThan(0);
  });

  it('deja el producto de Inicio listo para el detalle', async () => {
    const raw = productFixture(1);
    jest.spyOn(homeService, 'getHome').mockResolvedValue({
      banners: [],
      categories: [],
      products: [],
      rawProducts: [raw],
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const { unmount } = await renderHook(useHome, {
      wrapper: ({ children }) => <QueryTestProvider client={client}>{children}</QueryTestProvider>,
    });
    // El detalle lo encuentra sin consultar: no monta su skeleton.
    await waitFor(() => expect(client.getQueryData(productDetailKey(1))).toEqual({ product: raw }));
    await unmount();
  });
});
