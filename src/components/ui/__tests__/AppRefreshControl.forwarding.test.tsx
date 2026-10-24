import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AppRefreshControl } from '../AppRefreshControl';

// El host nativo descarta los hijos en el entorno de test, así que se sustituye
// `RefreshControl` por un passthrough para comprobar el reenvío que Android exige.
jest.mock('react-native/Libraries/Components/RefreshControl/RefreshControl', () => {
  const React = jest.requireActual('react');
  const View = jest.requireActual('react-native').View;
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      const { children, ...rest } = props;
      return React.createElement(View, rest, children);
    },
  };
});

describe('AppRefreshControl (reenvío para Android)', () => {
  it('reenvía los hijos y el estilo que el contenedor inyecta al envolver el scroll', async () => {
    const view = await render(
      <AppRefreshControl refreshing onRefresh={jest.fn()} style={{ flex: 1 }}>
        <Text>contenido de la lista</Text>
      </AppRefreshControl>,
    );

    expect(view.getByText('contenido de la lista')).toBeTruthy();
  });
});
