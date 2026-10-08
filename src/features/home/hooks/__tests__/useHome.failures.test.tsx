import { act, renderHook, waitFor } from '@testing-library/react-native';
import { homeServiceMock } from '../../services/homeService.mock';
import { homeService } from '../../services/homeService.api';
import { installHomePreviewApiMock } from '../../../../../tests/support/home-preview-api-mock';
import type { HomeData } from '../../services/homeService';
import { useHome } from '../useHome';
import { QueryTestProvider } from '../../../../../tests/support/query-wrapper';

describe('Recuperación y concurrencia de useHome', () => {
  beforeEach(installHomePreviewApiMock);
  it('expone errores del servicio y permite recuperar los datos', async () => {
    const getHome = jest
      .spyOn(homeService, 'getHome')
      .mockRejectedValueOnce(new Error('No disponible'));
    const { result } = await renderHook(useHome, { wrapper: QueryTestProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe('No disponible');
    expect(result.current.data).toBeNull();
    await act(() => result.current.refetch());
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.data?.products.length).toBeGreaterThan(0);
    expect(getHome).toHaveBeenCalledTimes(2);
  });

  it('normaliza un rechazo sin instancia de Error', async () => {
    jest.spyOn(homeService, 'getHome').mockRejectedValueOnce('fallo');
    const { result } = await renderHook(useHome, { wrapper: QueryTestProvider });
    await waitFor(() => expect(result.current.error?.message).toBe('Error al cargar Home.'));
  });

  it('deduplica refetch concurrente durante la carga inicial', async () => {
    let resolve!: (data: HomeData) => void;
    const latest = await homeServiceMock.getHome();
    const service = jest.spyOn(homeService, 'getHome').mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result } = await renderHook(useHome, { wrapper: QueryTestProvider });
    let refetch!: ReturnType<typeof result.current.refetch>;
    await act(() => {
      refetch = result.current.refetch();
    });
    expect(service).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve(latest);
      await refetch;
    });
    await waitFor(() => expect(result.current.data).toEqual(latest));
    expect(result.current.loading).toBe(false);
  });
});
