import { z } from 'zod';
import { httpClient } from '@/services/http/client';
import { ApiError, isApiError, UserFacingError } from '@/services/http/api-error';

export const deletionReceiptSchema = z.object({
  id: z.uuid(),
  status: z.enum(['WAITING_OBLIGATIONS', 'PROCESSING', 'COMPLETED']),
  message: z.string(),
});
export type DeletionReceipt = z.infer<typeof deletionReceiptSchema>;
const challengeSchema = z.object({
  message: z.string(),
  resendAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});
export type DeletionChallenge = z.infer<typeof challengeSchema>;
const statusSchema = z.object({
  request: deletionReceiptSchema.nullable(),
  pendingObligations: z.number().int().nonnegative(),
});

async function post<T>(path: string, json: object, schema: z.ZodType<T>) {
  try {
    const response = await httpClient.request(path, { method: 'POST', json, credentials: 'omit' });
    const parsed = schema.safeParse(response);
    if (!parsed.success)
      throw new ApiError('Respuesta de eliminación inválida.', { kind: 'parse' });
    return parsed.data;
  } catch (error) {
    if (isApiError(error) && error.status === 400)
      throw new UserFacingError('El código es inválido o expiró. Solicita uno nuevo.');
    if (isApiError(error) && error.status === 429)
      throw new UserFacingError('Demasiados intentos. Espera antes de continuar.');
    throw error;
  }
}
export const accountDeletionService = {
  request: (correo: string) => post('/account-deletion/request', { correo }, challengeSchema),
  confirm: (correo: string, codigo: string) =>
    post('/account-deletion/confirm', { correo, codigo }, deletionReceiptSchema),
  async status(signal?: AbortSignal) {
    const response = await httpClient.request('/account-deletion/me', {
      authenticated: true,
      cache: 'no-store',
      signal,
    });
    const parsed = statusSchema.safeParse(response);
    if (!parsed.success) throw new ApiError('Estado de eliminación inválido.', { kind: 'parse' });
    return parsed.data;
  },
};
