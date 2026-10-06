import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useHome } from '../useHome';

describe('useHome', () => {
  it('expone los datos del servicio mock una vez resuelto', async () => {
    const { result } = await renderHook(() => useHome());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.categories.length).toBeGreaterThan(0);
    expect(result.current.data?.banners.length).toBeGreaterThan(0);
    expect(result.current.data?.products.length).toBeGreaterThan(0);
  });

  it('refetch vuelve a cargar los datos', async () => {
    const { result } = await renderHook(() => useHome());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data?.products.length).toBeGreaterThan(0);
  });
});
