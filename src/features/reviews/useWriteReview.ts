import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { UserFacingError } from '@/services/http/api-error';
import { productDetailKey } from '@/services/products/product-cache';
import { productRepository } from '@/services/products/product-repository';
import {
  reviewService,
  ownReviewKey,
  isReviewProductId,
  type ReviewFormValues,
} from './review-service';

export function useWriteReview(productId: string) {
  const auth = useAuth();
  const client = useQueryClient();
  const { isOnline } = useNetworkStatus();
  const [saving, setSaving] = useState(false);
  const locked = useRef(false);
  const valid = isReviewProductId(productId);
  const enabled = valid && auth.status === 'authenticated' && !!auth.user;
  const query = useQuery({
    queryKey: ownReviewKey(auth.user?.id, productId),
    queryFn: ({ signal }) => reviewService.mine(productId, signal),
    enabled: enabled && !saving,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const productQuery = useQuery({
    queryKey: productDetailKey(productId),
    queryFn: ({ signal }) => productRepository.detail(productId, signal),
    enabled,
    retry: false,
  });
  async function save(values: ReviewFormValues) {
    if (locked.current) throw new UserFacingError('Espera a que termine el envío.');
    if (isOnline === false) throw new UserFacingError('Conéctate para enviar tu reseña.');
    const owner = auth.user?.id;
    const version = auth.getSessionVersion();
    const current = () =>
      auth.getSession().user?.id === owner && auth.getSessionVersion() === version;
    if (!owner || auth.status !== 'authenticated')
      throw new UserFacingError('Inicia sesión para escribir una reseña.');
    locked.current = true;
    setSaving(true);
    try {
      const key = ownReviewKey(owner, productId);
      await client.cancelQueries({ queryKey: key });
      if (!current()) throw new UserFacingError('La sesión cambió. Vuelve a abrir tus reseñas.');
      const result = await reviewService.submit(productId, values);
      if (!current()) throw new UserFacingError('La sesión cambió. Vuelve a abrir tus reseñas.');
      client.setQueryData(key, { review: result.review });
      void client.invalidateQueries({ queryKey: ['account', owner, 'reviews'] });
      void client.invalidateQueries({ queryKey: ['reviews', 'product', productId] });
      return result;
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }
  return { query, productQuery, isOnline, saving, save, valid, userId: auth.user?.id };
}
