import { act, renderHook, waitFor } from '@testing-library/react-native';
import { focusManager } from '@tanstack/react-query';
import { QueryTestProvider } from '../../../../tests/support/query-wrapper';
import { useAccountResource } from '../useAccountResource';

let mockFocused = true;
let mockOnline = true;
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    const focused = mockFocused;
    useEffect(() => (focused ? callback() : undefined), [callback, focused]);
  },
}));
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 7, rol: 'CLIENT' }, status: 'authenticated' }),
}));
jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: mockOnline }),
}));

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());
beforeEach(() => {
  mockFocused = true;
  mockOnline = true;
  focusManager.setFocused(true);
});
afterEach(() => {
  focusManager.setFocused(undefined);
});

it('actualiza automáticamente y pausa al salir de la pantalla, perder red o ir a segundo plano', async () => {
  const load = jest.fn().mockResolvedValue({ status: 'PENDING' });
  const { result, rerender } = await renderHook(
    () => useAccountResource(['rentals'], load, { autoRefresh: true }),
    { wrapper: QueryTestProvider },
  );
  await waitFor(() => expect(result.current.query.data).toEqual({ status: 'PENDING' }));
  load.mockResolvedValue({ status: 'APPROVED' });
  await act(() => jest.advanceTimersByTimeAsync(30_000));
  expect(result.current.query.data).toEqual({ status: 'APPROVED' });

  mockFocused = false;
  await rerender({});
  load.mockClear();
  await act(() => jest.advanceTimersByTimeAsync(60_000));
  expect(load).not.toHaveBeenCalled();

  mockFocused = true;
  await rerender({});
  await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  mockOnline = false;
  await rerender({});
  load.mockClear();
  await act(() => jest.advanceTimersByTimeAsync(60_000));
  expect(load).not.toHaveBeenCalled();

  mockOnline = true;
  await rerender({});
  await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  await act(() => focusManager.setFocused(false));
  load.mockClear();
  await act(() => jest.advanceTimersByTimeAsync(60_000));
  expect(load).not.toHaveBeenCalled();
});

it('no actualiza periódicamente documentos ni recursos deshabilitados', async () => {
  const load = jest.fn().mockResolvedValue({ document: 'legal' });
  await renderHook(() => useAccountResource(['legal'], load), {
    wrapper: QueryTestProvider,
  });
  expect(load).toHaveBeenCalledTimes(1);
  load.mockClear();
  await act(() => jest.advanceTimersByTimeAsync(60_000));
  expect(load).not.toHaveBeenCalled();

  await renderHook(
    () => useAccountResource(['rental'], load, { autoRefresh: true, enabled: false }),
    { wrapper: QueryTestProvider },
  );
  await act(() => jest.advanceTimersByTimeAsync(60_000));
  expect(load).not.toHaveBeenCalled();
});
