import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function QueryTestProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
