import { createToastStore } from '../toast-store';

describe('toast lifecycle and concurrent operations', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('keeps loading until confirmation and rejects older operations even with identical messages', () => {
    const store = createToastStore();
    const old = store.api.loading('Enviando...');
    jest.advanceTimersByTime(60000);
    expect(store.getSnapshot()?.type).toBe('loading');
    const latest = store.api.loading('Enviando...');
    store.api.update(old, { type: 'error', message: 'Error anterior' });
    expect(store.getSnapshot()?.id).toBe(latest);
    expect(store.getSnapshot()?.type).toBe('loading');
    store.dispose();
  });

  it('deduplicates results and only unmounts after the matching exit animation', () => {
    const store = createToastStore();
    const id = store.api.success('Guardado');
    expect(store.api.success('Guardado')).toBe(id);
    jest.advanceTimersByTime(3800);
    const exiting = store.getSnapshot()!;
    expect(exiting.closing).toBe(true);
    store.api.info('Nuevo aviso');
    store.finishExit(id, exiting.revision);
    expect(store.getSnapshot()?.message).toBe('Nuevo aviso');
    store.api.dismiss();
    const final = store.getSnapshot()!;
    store.finishExit(final.id, final.revision);
    expect(store.getSnapshot()).toBeNull();
    store.dispose();
  });

  it('locks undo synchronously, waits for restoration, and ignores late results', async () => {
    const store = createToastStore();
    let resolve!: () => void;
    const onUndo = jest.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const id = store.api.undoable({
      message: 'Producto eliminado',
      onUndo,
      errorMessage: 'No se pudo restaurar',
    });
    const pending = store.undo(id);
    await store.undo(id);
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()?.type).toBe('loading');
    jest.advanceTimersByTime(6000);
    expect(store.getSnapshot()?.closing).toBe(false);
    store.api.info('Más reciente');
    resolve();
    await pending;
    expect(store.getSnapshot()?.message).toBe('Más reciente');
    store.dispose();
  });

  it('confirms restoration and reports its specific failure', async () => {
    const store = createToastStore();
    const success = store.api.undoable({
      message: 'Eliminado',
      onUndo: async () => {},
      errorMessage: 'Error',
    });
    await store.undo(success);
    expect(store.getSnapshot()?.message).toBe('Producto restaurado');
    const failure = store.api.undoable({
      message: 'Eliminado',
      onUndo: async () => {
        throw new Error('offline');
      },
      errorMessage: 'No se pudo restaurar: sin conexión',
    });
    await store.undo(failure);
    expect(store.getSnapshot()?.type).toBe('error');
    expect(store.getSnapshot()?.message).toBe('No se pudo restaurar: sin conexión');
    store.dispose();
  });

  it('expires undo, cleans timers, and prevents work after unmount', async () => {
    const store = createToastStore();
    const onUndo = jest.fn(async () => {});
    const id = store.api.undoable({ message: 'Eliminado', onUndo, errorMessage: 'Error' });
    jest.advanceTimersByTime(6000);
    await store.undo(id);
    expect(onUndo).not.toHaveBeenCalled();
    store.dispose();
    store.api.update(id, { type: 'success', message: 'Tarde' });
    expect(store.getSnapshot()).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('tracks isScrolled and notifies subscribers', () => {
    const store = createToastStore();
    expect(store.getIsScrolled()).toBe(false);
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);
    store.api.setScrolled(true);
    expect(store.getIsScrolled()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    // deduplicates redundant values
    store.api.setScrolled(true);
    expect(listener).toHaveBeenCalledTimes(1);
    store.api.setScrolled(false);
    expect(store.getIsScrolled()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.dispose();
  });
});
