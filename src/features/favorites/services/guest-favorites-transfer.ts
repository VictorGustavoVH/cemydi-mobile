import { ApiError, isApiError, UserFacingError } from '@/services/http/api-error';
import { favoriteService } from './favorite-service';

type TransferOptions = {
  isCurrent: () => boolean;
  canContinue: () => boolean;
  onSaved: (id: string) => void;
};

export async function transferGuestFavorites(ids: readonly string[], options: TransferOptions) {
  const uniqueIds = [...new Set(ids)];
  let saved = 0;
  for (const id of uniqueIds) {
    if (!options.isCurrent()) throw new ApiError('La sesión cambió.', { kind: 'abort' });
    if (!options.canContinue()) break;
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) continue;
    try {
      // Add is idempotent; toggle could remove a favorite already present in the account.
      const result = await favoriteService.add(Number(id));
      if (!options.isCurrent()) throw new ApiError('La sesión cambió.', { kind: 'abort' });
      if (!result.favorited || result.productId !== Number(id))
        throw new UserFacingError('No pudimos confirmar el favorito guardado.');
      options.onSaved(id);
      saved += 1;
    } catch (error) {
      if (!options.isCurrent() || (isApiError(error) && error.kind === 'abort')) throw error;
      // Keep unavailable products pending, but let the other selected products transfer.
      if (isApiError(error) && error.status === 404) continue;
      // Network failures, uncertain responses and 429 stop the batch, without a retry loop.
      break;
    }
  }
  return { saved, remaining: uniqueIds.length - saved };
}
