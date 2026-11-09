import { useLayoutEffect, useState, type ReactNode } from 'react';
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
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: Infinity },
        },
      }),
  );
  useLayoutEffect(() => {
    // clear() durante login/logout puede retirar una query antes de que su
    // observador se desprenda y vuelva a programar GC. Conservamos referencias
    // también a esas entradas para destruirlas al terminar la prueba.
    const queryCache = client.getQueryCache();
    const mutationCache = client.getMutationCache();
    const queries = new Set(queryCache.getAll());
    const mutations = new Set(mutationCache.getAll());
    const unsubscribeQueries = queryCache.subscribe((event) => {
      if (event.type === 'added') queries.add(event.query);
    });
    const unsubscribeMutations = mutationCache.subscribe((event) => {
      if (event.type === 'added') mutations.add(event.mutation);
    });
    return () => {
      // Espera el cleanup de los hijos y la finalización de las cancelaciones.
      void Promise.resolve().then(async () => {
        await Promise.all([...queries].map((query) => query.cancel({ silent: true })));
        for (const query of queries) query.destroy();
        for (const mutation of mutations) mutation.destroy();
        client.clear();
        unsubscribeQueries();
        unsubscribeMutations();
      });
    };
  }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
