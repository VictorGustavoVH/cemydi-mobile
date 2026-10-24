import { z } from 'zod';
import { httpClient } from '@/services/http/client';
import { ApiError, isApiError, UserFacingError } from '@/services/http/api-error';

const challengeSchema = z.object({
  message: z.string(),
  resendAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});
const messageSchema = z.object({ message: z.string() });
export type AccountChallenge = z.infer<typeof challengeSchema>;

async function post<T>(path: string, json: unknown, schema: z.ZodType<T>): Promise<T> {
  try {
    const response = await httpClient.request(path, {
      authenticated: true,
      method: 'POST',
      json,
    });
    const parsed = schema.safeParse(response);
    if (!parsed.success) throw new ApiError('Respuesta inválida.', { kind: 'parse' });
    return parsed.data;
  } catch (error) {
    if (isApiError(error) && error.kind === 'http') {
      if (error.status === 429)
        throw new UserFacingError('Espera antes de solicitar o verificar otro código.');
      if (error.status === 409)
        throw new UserFacingError('No se pudo usar ese correo. Prueba con otro.');
      if (error.status === 400)
        throw new UserFacingError('Los datos o el código son inválidos o expiraron.');
      if (error.status === 401)
        throw new UserFacingError('No pudimos confirmar tu identidad. Revisa tu contraseña.');
    }
    throw error;
  }
}

export const accountSecurityService = {
  requestEmailChange(newEmail: string, currentPassword: string) {
    return post('/users/me/email-change/request', { newEmail, currentPassword }, challengeSchema);
  },
  resendEmailChange() {
    return post('/users/me/email-change/resend', {}, challengeSchema);
  },
  confirmEmailChange(newEmail: string, codigo: string) {
    return post('/users/me/email-change/confirm', { newEmail, codigo }, messageSchema);
  },
  requestPasswordChange(currentPassword: string) {
    return post('/users/me/password-change/request', { currentPassword }, challengeSchema);
  },
  resendPasswordChange() {
    return post('/users/me/password-change/resend', {}, challengeSchema);
  },
  confirmPasswordChange(codigo: string, newPassword: string) {
    return post('/users/me/password-change/confirm', { codigo, newPassword }, messageSchema);
  },
};
