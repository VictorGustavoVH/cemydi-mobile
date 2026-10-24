import { z } from 'zod';
import { httpClient } from '@/services/http/client';
import { ApiError, isApiError, UserFacingError } from '@/services/http/api-error';

export async function authPost<T>(
  path: string,
  json: unknown,
  schema: z.ZodType<T>,
  mapErrors = true,
): Promise<T> {
  try {
    const data = await httpClient.request(path, { method: 'POST', json, credentials: 'omit' });
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new ApiError('Respuesta de autenticación inválida.', { kind: 'parse' });
    }
    return result.data;
  } catch (error) {
    if (mapErrors && isApiError(error) && error.kind === 'http') {
      if (error.status === 429) {
        throw new UserFacingError(
          'Has realizado demasiados intentos. Espera antes de intentar de nuevo.',
        );
      }
      if (error.status === 400)
        throw new UserFacingError(
          'Los datos o el código son inválidos o expiraron. Revisa e intenta de nuevo.',
        );
      if (error.status === 401 || error.status === 403) {
        throw new UserFacingError(
          'No se pudo validar el acceso. Revisa tus datos y verifica tu correo.',
        );
      }
    }
    throw error;
  }
}
