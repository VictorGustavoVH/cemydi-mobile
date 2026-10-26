import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ErrorBoundary } from '../ErrorBoundary';
import { AppButton } from '../ui/AppButton';

it('remonta los hijos con estado limpio al reintentar', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const mounted = jest.fn();
  function Child() {
    const [failed, setFailed] = useState(false);
    useEffect(() => {
      mounted();
    }, []);
    if (failed) throw new Error('Fallo de prueba');
    return (
      <>
        <Text>Contenido limpio</Text>
        <AppButton label="Provocar error" onPress={() => setFailed(true)} />
      </>
    );
  }
  await render(
    <ErrorBoundary>
      <Child />
    </ErrorBoundary>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Provocar error' }));
  expect(screen.queryByText('Contenido limpio')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
  expect(screen.getByText('Contenido limpio')).toBeTruthy();
  expect(mounted).toHaveBeenCalledTimes(2);
});
