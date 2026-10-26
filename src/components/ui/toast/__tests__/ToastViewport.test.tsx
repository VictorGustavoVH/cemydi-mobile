import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastContext } from '@/hooks/useToast';
import { createToastStore } from '../toast-store';
import { ToastViewport } from '../ToastViewport';

const metrics = {
  frame: { x: 0, y: 0, width: 360, height: 800 },
  insets: { top: 44, bottom: 34, left: 0, right: 0 },
};

it('positions only the requested deletion countdown above the measured navigation bar', async () => {
  const store = createToastStore();
  store.setBottomBarHeight(112);
  store.api.undoable({
    message: 'Producto eliminado',
    placement: 'bottom',
    onUndo: async () => undefined,
    errorMessage: 'No se pudo restaurar',
  });
  const view = await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ToastContext.Provider value={store}>
        <ToastViewport />
      </ToastContext.Provider>
    </SafeAreaProvider>,
  );
  expect(screen.getByTestId('toast-viewport')).toHaveStyle({ bottom: 124 });
  expect(screen.getByTestId('toast-viewport')).not.toHaveStyle({ top: 82 });
  await act(async () => store.setBottomBarHeight(140));
  expect(screen.getByTestId('toast-viewport')).toHaveStyle({ bottom: 152 });
  await act(async () => store.setBottomBarHeight(0));
  expect(screen.getByTestId('toast-viewport')).toHaveStyle({ bottom: 46 });
  await fireEvent.press(screen.getByRole('button', { name: 'Deshacer eliminación del producto' }));
  expect(screen.getByText('Producto restaurado')).toBeTruthy();
  expect(screen.getByTestId('toast-viewport')).toHaveStyle({ top: 82 });
  await act(async () => {
    store.api.undoable({
      message: 'Otra eliminación',
      onUndo: async () => undefined,
      errorMessage: 'Error',
    });
  });
  expect(screen.getByTestId('toast-viewport')).toHaveStyle({ top: 82 });
  await view.unmount();
  store.dispose();
});

it('renders a single countdown, routes to the modal host and invokes the accessible undo action', async () => {
  const store = createToastStore();
  let finish!: () => void;
  const onUndo = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  store.api.undoable({
    message: 'Producto eliminado',
    onUndo,
    errorMessage: 'No se pudo restaurar',
  });
  const view = await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ToastContext.Provider value={store}>
        <ToastViewport />
        <ToastViewport modal />
      </ToastContext.Provider>
    </SafeAreaProvider>,
  );
  expect(screen.getAllByText('Producto eliminado')).toHaveLength(1);
  expect(screen.getAllByText('6', { includeHiddenElements: true })).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Cerrar notificación' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Deshacer eliminación del producto' }));
  expect(onUndo).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Deshacer eliminación del producto' })).toBeNull();
  expect(screen.getByText('Restaurando producto...')).toBeTruthy();
  await act(async () => {
    finish();
  });
  expect(screen.getByText('Producto restaurado')).toBeTruthy();
  await view.unmount();
  store.dispose();
});

it('renders close button on non-undo toast and dismisses when pressed', async () => {
  const store = createToastStore();
  store.api.success('Producto agregado');
  const view = await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ToastContext.Provider value={store}>
        <ToastViewport />
      </ToastContext.Provider>
    </SafeAreaProvider>,
  );
  expect(screen.getByText('Producto agregado')).toBeTruthy();
  const closeButton = screen.getByRole('button', { name: 'Cerrar notificación' });
  expect(closeButton).toBeTruthy();
  await fireEvent.press(closeButton);
  expect(store.getSnapshot()?.closing).toBe(true);
  await view.unmount();
  store.dispose();
});

it('adapts when scrolled state changes', async () => {
  const store = createToastStore();
  store.api.info('Notificación informativa');
  const view = await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ToastContext.Provider value={store}>
        <ToastViewport />
      </ToastContext.Provider>
    </SafeAreaProvider>,
  );
  expect(screen.getByText('Notificación informativa')).toBeTruthy();
  await act(async () => {
    store.api.setScrolled(true);
  });
  expect(screen.getByText('Notificación informativa')).toBeTruthy();
  await act(async () => {
    store.api.setScrolled(false);
  });
  expect(screen.getByText('Notificación informativa')).toBeTruthy();
  await view.unmount();
  store.dispose();
});
