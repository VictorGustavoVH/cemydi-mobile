import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productService } from '@/services/products/product-service';

export function useProductOffers() {
  const [expirationTick, setExpirationTick] = useState(() => Date.now());
  const query = useQuery({
    queryKey: ['promotions', 'active'],
    queryFn: ({ signal }) => productService.offers(signal),
    staleTime: 30_000,
  });
  const data = useMemo(() => {
    if (!query.data) return undefined;
    const now = Math.max(query.dataUpdatedAt, expirationTick);
    return {
      promotions: query.data.promotions.filter(
        (offer) => Date.parse(offer.startAt) <= now && Date.parse(offer.endAt) > now,
      ),
    };
  }, [query.data, query.dataUpdatedAt, expirationTick]);
  useEffect(() => {
    const now = Math.max(Date.now(), expirationTick);
    const nextExpiration = Math.min(
      ...(query.data?.promotions ?? [])
        .map((offer) => Date.parse(offer.endAt))
        .filter((time) => time > now),
    );
    if (!Number.isFinite(nextExpiration)) return;
    const timer = setTimeout(
      () => setExpirationTick(Date.now()),
      Math.min(nextExpiration - now + 1, 2_147_483_647),
    );
    return () => clearTimeout(timer);
  }, [query.data, expirationTick]);
  /**
   * `ready` indica que ya sabemos qué ofertas aplican: llegaron, fallaron o no
   * hay una primera consulta en vuelo (pausa offline incluida). Las tarjetas y
   * el detalle CRECEN al mostrar la oferta (precio tachado, porcentaje y su
   * propia línea), así que las pantallas esperan a `ready` antes de pintar
   * precios: mostrarlos primero y completarlos después se ve como un salto de
   * layout sobre la lista que el usuario está leyendo.
   */
  const ready = Boolean(query.data) || query.error != null || !query.isFetching;
  return { ...query, data, ready };
}
