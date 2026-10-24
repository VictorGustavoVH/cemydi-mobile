import { act, renderHook } from '@testing-library/react-native';
import { useRouteCallback } from '../useRouteCallback';

it('bloquea solo la misma ruta durante 800 ms, incluso tras visitar otra', async () => {
  let now = 0;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  const action = jest.fn();
  const { result } = await renderHook(() =>
    useRouteCallback(action, (id: string) => `/producto/${id}`),
  );
  await act(() => {
    result.current('a');
    result.current('a');
    result.current('b');
    result.current('a');
  });
  expect(action.mock.calls).toEqual([['a'], ['b']]);
  now = 799;
  await act(() => result.current('a'));
  expect(action).toHaveBeenCalledTimes(2);
  now = 800;
  await act(() => result.current('a'));
  expect(action).toHaveBeenCalledTimes(3);
});
