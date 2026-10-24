import { useState, type ReactElement, type ReactNode } from 'react';
import { render as renderNative } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/providers/toast-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { createAuthSession } from '@/features/auth/services/auth-session';
import { QueryTestProvider } from './query-wrapper';

function ToastTestProvider({ children }: { children: ReactNode }) {
  const [session] = useState(() =>
    createAuthSession({
      get: async () => null,
      set: async () => undefined,
      remove: async () => undefined,
    }),
  );
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 44, bottom: 34, left: 0, right: 0 },
      }}
    >
      <ToastProvider>
        <QueryTestProvider>
          <AuthProvider session={session}>{children}</AuthProvider>
        </QueryTestProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

export function render(ui: ReactElement) {
  return renderNative(ui, { wrapper: ToastTestProvider });
}
