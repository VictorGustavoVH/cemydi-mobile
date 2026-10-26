export type ToastConfig =
  | { type: 'loading'; message: string }
  | { type: 'success' | 'error' | 'info'; message: string; duration?: number }
  | ({ type: 'undo' } & UndoToastOptions);

export type UndoToastOptions = {
  message: string;
  placement?: 'bottom';
  duration?: number;
  onUndo: () => Promise<void>;
  restoringMessage?: string;
  restoredMessage?: string;
  errorMessage: string;
};

export type ToastEntry = ToastConfig & {
  id: number;
  revision: number;
  deadline: number | null;
  closing: boolean;
};

const durationOf = (config: ToastConfig) =>
  config.type === 'loading'
    ? null
    : Math.max(1000, config.duration ?? (config.type === 'undo' ? 6000 : 3800));

/** One visible toast, latest wins. Stale operations cannot update a newer toast. */
export function createToastStore() {
  let current: ToastEntry | null = null;
  let isScrolled = false;
  let bottomBarHeight = 0;
  let serial = 0;
  let alive = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  let hosts: string[] = [];
  const emit = () => listeners.forEach((listener) => listener());
  const clearTimer = () => clearTimeout(timer);
  const setScrolled = (value: boolean) => {
    if (!alive || isScrolled === value) return;
    isScrolled = value;
    emit();
  };
  const dismiss = (id = current?.id) => {
    if (!alive || !current || current.id !== id || current.closing) return;
    clearTimer();
    current = { ...current, closing: true };
    emit();
  };
  const apply = (id: number, config: ToastConfig) => {
    clearTimer();
    const duration = durationOf(config);
    current = {
      ...config,
      id,
      revision: (current?.revision ?? 0) + 1,
      deadline: duration === null ? null : Date.now() + duration,
      closing: false,
    };
    if (duration !== null) timer = setTimeout(() => dismiss(id), duration);
    emit();
  };
  const show = (config: ToastConfig) => {
    if (!alive) return -1;
    if (
      current &&
      !current.closing &&
      current.type === config.type &&
      current.message === config.message &&
      config.type !== 'undo' &&
      config.type !== 'loading'
    )
      return current.id;
    const id = ++serial;
    apply(id, config);
    return id;
  };
  const update = (id: number, config: ToastConfig) => {
    if (!alive || current?.id !== id || current.closing) return;
    apply(id, config);
  };
  const undo = async (id: number) => {
    const entry = current;
    if (!alive || !entry || entry.id !== id || entry.closing || entry.type !== 'undo') return;
    if (entry.deadline !== null && Date.now() >= entry.deadline) {
      dismiss(id);
      return;
    }
    // Synchronous transition is also the double-press lock.
    update(id, { type: 'loading', message: entry.restoringMessage ?? 'Restaurando producto...' });
    try {
      await entry.onUndo();
      update(id, { type: 'success', message: entry.restoredMessage ?? 'Producto restaurado' });
    } catch {
      update(id, { type: 'error', message: entry.errorMessage });
    }
  };
  const api = {
    loading: (message: string) => show({ type: 'loading', message }),
    success: (message: string, duration?: number) => show({ type: 'success', message, duration }),
    error: (message: string, duration?: number) => show({ type: 'error', message, duration }),
    info: (message: string, duration?: number) => show({ type: 'info', message, duration }),
    undoable: (options: UndoToastOptions) => show({ ...options, type: 'undo' }),
    update,
    dismiss,
    setScrolled,
  };
  return {
    api,
    undo,
    getActiveHost: () => hosts.at(-1) ?? null,
    registerHost: (id: string) => {
      hosts = [...hosts, id];
      emit();
      return () => {
        hosts = hosts.filter((host) => host !== id);
        emit();
      };
    },
    getSnapshot: () => current,
    getIsScrolled: () => isScrolled,
    getBottomBarHeight: () => bottomBarHeight,
    setBottomBarHeight: (height: number) => {
      if (!alive || bottomBarHeight === height) return;
      bottomBarHeight = height;
      emit();
    },
    setScrolled,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    finishExit: (id: number, revision: number) => {
      if (current?.id !== id || current.revision !== revision || !current.closing) return;
      current = null;
      emit();
    },
    resume: () => {
      if (current?.deadline && Date.now() >= current.deadline) dismiss(current.id);
    },
    start: () => {
      alive = true;
    },
    dispose: () => {
      alive = false;
      clearTimer();
      current = null;
      isScrolled = false;
    },
  };
}

export type ToastStore = ReturnType<typeof createToastStore>;
