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
  return { ...query, data };
}
