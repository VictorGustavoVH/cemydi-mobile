import { createContext, useCallback, useContext } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type { ToastStore } from '@/components/ui/toast/toast-store';

export const ToastContext = createContext<ToastStore | null>(null);

export function useToast() {
  const store = useContext(ToastContext);
  if (!store) throw new Error('useToast requiere ToastProvider');
  return store.api;
}

export function useToastScroll() {
  const store = useContext(ToastContext);
  return useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      store?.setScrolled(event.nativeEvent.contentOffset.y > 15);
    },
    [store],
  );
}
