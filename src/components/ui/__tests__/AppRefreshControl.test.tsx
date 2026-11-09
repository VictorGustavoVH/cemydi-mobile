import { fireEvent, render } from '@testing-library/react-native';

import { AppRefreshControl } from '../AppRefreshControl';
import { Platform, ScrollView, Text } from 'react-native';

const REFRESH_CONTROL_TYPES = new Set(['RCTRefreshControl', 'AndroidSwipeRefreshLayout']);

const findRefreshControl = (view: Awaited<ReturnType<typeof render>>) => {
  const root = view.root;
  if (!root) return undefined;
  return [root, ...root.queryAll(() => true)].find((node) => REFRESH_CONTROL_TYPES.has(node.type));
};

describe('AppRefreshControl', () => {
  it('conserva el contenido y reenvía el gesto cuando Android envuelve el ScrollView', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const refresh = jest.fn();
    const view = await render(
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<AppRefreshControl refreshing={false} onRefresh={refresh} />}
      >
        <Text>Contenido de la pantalla</Text>
      </ScrollView>,
    );
    expect(view.getByText('Contenido de la pantalla')).toBeTruthy();
    const control = findRefreshControl(view);
    expect(control).toBeTruthy();
    await fireEvent(control!, 'refresh');
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('renderiza un RefreshControl y reenvía el gesto de refresco', async () => {
    const onRefresh = jest.fn();
    const view = await render(<AppRefreshControl refreshing onRefresh={onRefresh} />);

    const control = findRefreshControl(view);
    expect(control).toBeTruthy();

    await fireEvent(control!, 'refresh');
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
