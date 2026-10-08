import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, View } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { createToastStore } from '@/components/ui/toast/toast-store';
import { ToastViewport } from '@/components/ui/toast/ToastViewport';

import { ToastContext } from '@/hooks/useToast';

export function ToastProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createToastStore);
  const target = useRef<View | null>(null);
  useEffect(() => {
    store.start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') store.resume();
    });
    return () => {
      subscription.remove();
      store.dispose();
    };
  }, [store]);
  return (
    <ToastContext.Provider value={store}>
      <View style={{ flex: 1 }}>
        <BlurTargetView ref={target} style={{ flex: 1 }}>
          {children}
        </BlurTargetView>
        <ToastViewport blurTarget={target} />
      </View>
    </ToastContext.Provider>
  );
}
