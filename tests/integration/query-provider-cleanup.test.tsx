import { act, renderHook } from '@testing-library/react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QueryTestProvider } from '../support/query-wrapper';

it('no deja temporizadores de mutaciones después de desmontar el proveedor de pruebas', async () => {
  jest.useFakeTimers();
  try {
    const view = await renderHook(() => useMutation({ mutationFn: async () => 'guardado' }), {
      wrapper: QueryTestProvider,
    });
    await act(async () => {
      await view.result.current.mutateAsync();
    });
    await view.unmount();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

it('destruye timers de consultas retiradas de la caché durante un cambio de cuenta', async () => {
  jest.useFakeTimers();
  try {
    const view = await renderHook(
      ({ id }: { id: number }) => {
        const client = useQueryClient();
        useQuery({ queryKey: ['profile', id], queryFn: async () => 'dato', gcTime: 300_000 });
        return client;
      },
      { wrapper: QueryTestProvider, initialProps: { id: 0 } },
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
      view.result.current.clear();
    });
    await view.rerender({ id: 1 });
    await view.unmount();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

it('limpia también consultas con gcTime explícito después de retirar sus observadores', async () => {
  jest.useFakeTimers();
  try {
    const view = await renderHook(
      () => useQuery({ queryKey: ['cleanup'], queryFn: async () => 'dato', gcTime: 300_000 }),
      { wrapper: QueryTestProvider },
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    await view.unmount();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});
