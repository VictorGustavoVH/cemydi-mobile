import { useContext, useEffect, useId, useSyncExternalStore, type RefObject } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ToastContext } from '@/hooks/useToast';
import type { ToastStore } from './toast-store';
import { AnimatedToast } from './AnimatedToast';

/** Add inside a native Modal, after its content, with modal=true. */
export function ToastViewport({
  blurTarget,
  modal = false,
}: {
  blurTarget?: RefObject<View | null>;
  modal?: boolean;
}) {
  const store = useContext(ToastContext);
  return store ? <Viewport store={store} blurTarget={blurTarget} modal={modal} /> : null;
}

function Viewport({
  store,
  blurTarget,
  modal,
}: {
  store: ToastStore;
  blurTarget?: RefObject<View | null>;
  modal: boolean;
}) {
  const id = useId();
  const entry = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const host = useSyncExternalStore(store.subscribe, store.getActiveHost, store.getActiveHost);
  const isScrolled = useSyncExternalStore(
    store.subscribe,
    store.getIsScrolled,
    store.getIsScrolled,
  );
  const insets = useSafeAreaInsets();
  useEffect(() => (modal ? store.registerHost(id) : undefined), [modal, store, id]);
  if (!entry || (modal ? host !== id : host !== null)) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + 38,
        left: Math.max(12, insets.left),
        right: Math.max(12, insets.right),
        zIndex: 1000,
        alignItems: 'center',
      }}
    >
      <View pointerEvents="box-none" style={{ width: '100%', maxWidth: 480 }}>
        <AnimatedToast
          key={entry.id}
          entry={entry}
          scrolled={isScrolled}
          blurTarget={blurTarget}
          onUndo={store.undo}
          onDismiss={store.api.dismiss}
          onExited={store.finishExit}
        />
      </View>
    </View>
  );
}
