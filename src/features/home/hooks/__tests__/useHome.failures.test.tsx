import { act, renderHook, waitFor } from '@testing-library/react-native';
import { homeServiceMock } from '../../services/homeService.mock';
import type { HomeData } from '../../services/homeService';
import { useHome } from '../useHome';

describe('Recuperación y concurrencia de useHome', () => {
  it('expone errores del servicio y permite recuperar los datos', async () => {
    const getHome = jest
      .spyOn(homeServiceMock, 'getHome')
      .mockRejectedValueOnce(new Error('No disponible'));
    const { result } = await renderHook(useHome);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe('No disponible');
    expect(result.current.data).toBeNull();
    await act(() => result.current.refetch());
    expect(result.current.error).toBeNull();
    expect(result.current.data?.products.length).toBeGreaterThan(0);
    expect(getHome).toHaveBeenCalledTimes(2);
  });

  it('normaliza un rechazo sin instancia de Error', async () => {
    jest.spyOn(homeServiceMock, 'getHome').mockRejectedValueOnce('fallo');
    const { result } = await renderHook(useHome);
    await waitFor(() => expect(result.current.error?.message).toBe('Error al cargar Home.'));
  });

  it('conserva el resultado más reciente cuando una carga anterior termina después', async () => {
    let resolveFirst!: (data: HomeData) => void;
    const latest = await homeServiceMock.getHome();
    jest
      .spyOn(homeServiceMock, 'getHome')
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce(latest);
    const { result } = await renderHook(useHome);
    await act(() => result.current.refetch());
    await act(() => resolveFirst({ banners: [], categories: [], products: [] }));
    expect(result.current.data).toEqual(latest);
    expect(result.current.loading).toBe(false);
  });
});
