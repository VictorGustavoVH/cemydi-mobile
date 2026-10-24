import { fireEvent, render } from '@testing-library/react-native';

import { AppRefreshControl } from '../AppRefreshControl';

const REFRESH_CONTROL_TYPES = new Set(['RCTRefreshControl', 'AndroidSwipeRefreshLayout']);

const findRefreshControl = (view: Awaited<ReturnType<typeof render>>) => {
  const root = view.root;
  if (!root) return undefined;
  return [root, ...root.queryAll(() => true)].find((node) => REFRESH_CONTROL_TYPES.has(node.type));
};

describe('AppRefreshControl', () => {
  it('renderiza un RefreshControl y reenvía el gesto de refresco', async () => {
    const onRefresh = jest.fn();
    const view = await render(<AppRefreshControl refreshing onRefresh={onRefresh} />);

    const control = findRefreshControl(view);
    expect(control).toBeTruthy();

    await fireEvent(control!, 'refresh');
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
