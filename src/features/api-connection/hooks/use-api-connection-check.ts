import { useQuery } from '@tanstack/react-query';

import { checkApiConnection } from '../services/check-api-connection';

export const apiConnectionQueryKey = ['system', 'api-connection'] as const;

export function useApiConnectionCheck() {
  return useQuery({
    enabled: false,
    networkMode: 'always',
    queryFn: checkApiConnection,
    queryKey: apiConnectionQueryKey,
    retry: false,
  });
}
