import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function QueryTestProvider({
  children,
  client: suppliedClient,
}: {
  children: ReactNode;
  client?: QueryClient;
}) {
  const [client] = useState(
    () =>
      suppliedClient ??
      new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
