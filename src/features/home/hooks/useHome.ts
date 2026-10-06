import { useCallback, useEffect, useRef, useState } from 'react';

import { homeServiceMock } from '../services/homeService.mock';
import type { HomeData } from '../services/homeService';

/**
 * Fuente de datos de Home.
 *
 * NOTA: Por ahora se usa homeServiceMock porque no hay backend.
 * Cuando exista API real, cambia `homeServiceMock` por
 * `homeServiceApi` (src/features/home/services/homeService.api.ts);
 * el resto del feature no debe cambiar.
 */
export function useHome() {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const result = await homeServiceMock.getHome();
      if (id === requestId.current) {
        setData(result);
      }
    } catch (cause) {
      if (id === requestId.current) {
        setError(cause instanceof Error ? cause : new Error('Error al cargar Home.'));
      }
    } finally {
      if (id === requestId.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // load() sincroniza el estado con el servicio externo (mock por ahora, API después).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return { data, loading, error, refetch: load };
}
