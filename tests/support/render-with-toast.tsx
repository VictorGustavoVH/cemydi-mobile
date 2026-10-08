import type { ReactElement, ReactNode } from 'react';
import { render as renderNative } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/providers/toast-provider';
import { AuthPreviewProvider } from '@/providers/auth-preview-provider';
import { QueryTestProvider } from './query-wrapper';

function ToastTestProvider({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 44, bottom: 34, left: 0, right: 0 },
      }}
    >
      <ToastProvider>
        <QueryTestProvider>
          <AuthPreviewProvider>{children}</AuthPreviewProvider>
        </QueryTestProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

export function render(ui: ReactElement) {
  return renderNative(ui, { wrapper: ToastTestProvider });
}
