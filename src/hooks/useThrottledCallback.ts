import { useCallback, useEffect, useRef } from 'react';

/**
 * Retorna una versión limitada (throttled) de una función callback que descarta
 * llamadas adicionales si ocurren dentro de una ventana de tiempo (delayMs).
 * Útil para prevenir dobles toques en navegación y acciones de tarjetas/botones.
 * Mantiene una identidad de función estable para no invalidar React.memo.
 */
export function useThrottledCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs = 750,
): (...args: Args) => void {
  const lastCallRef = useRef(0);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback(
    (...args: Args) => {
      const now = Date.now();
      if (now - lastCallRef.current < delayMs) {
        return;
      }
      lastCallRef.current = now;
      callbackRef.current(...args);
    },
    [delayMs],
  );
}
