import { httpClient } from '@/services/http/client';
import { ApiError, isApiError, UserFacingError } from '@/services/http/api-error';
import {
  profileResponseSchema,
  profileUpdateResponseSchema,
  type UpdateProfilePayload,
} from './profile-schemas';

// Mensajes confirmados del backend para `PATCH /users/me` (validación de campos).
// Cualquier otro texto del servidor se reemplaza por un mensaje seguro en español.
const KNOWN_PROFILE_MESSAGES = new Set(['No hay campos para actualizar']);
const PROFILE_VALIDATION_PATTERNS = [
  /^El nombre debe tener al menos 2 caracteres$/,
  /^El nombre debe tener como máximo 120 caracteres$/,
  /^El teléfono debe tener como máximo 30 caracteres$/,
  /^La dirección debe tener como máximo 180 caracteres$/,
  /^El nombre debe ser texto$/,
  /^El teléfono debe ser texto$/,
  /^La dirección debe ser texto$/,
  /^La propiedad ".+" no está permitida$/,
];
function safeProfileError(message: string) {
  if (KNOWN_PROFILE_MESSAGES.has(message)) return message;
  if (PROFILE_VALIDATION_PATTERNS.some((pattern) => pattern.test(message))) return message;
  return 'No pudimos guardar los cambios. Revisa los datos e intenta de nuevo.';
}

export const profileService = {
  async get(signal?: AbortSignal) {
    const data = await httpClient.request('/users/me', {
      authenticated: true,
      cache: 'no-store',
      signal,
    });
    const parsed = profileResponseSchema.safeParse(data);
    if (!parsed.success) throw new ApiError('Perfil inválido.', { kind: 'parse' });
    if (!parsed.data.user)
      throw new UserFacingError('No pudimos verificar tu cuenta. Vuelve a iniciar sesión.');
    return parsed.data.user;
  },
  async update(payload: UpdateProfilePayload) {
    try {
      const data = await httpClient.request('/users/me', {
        authenticated: true,
        method: 'PATCH',
        json: payload,
      });
      const parsed = profileUpdateResponseSchema.safeParse(data);
      if (!parsed.success) throw new ApiError('Perfil inválido.', { kind: 'parse' });
      return parsed.data.user;
    } catch (error) {
      if (
        isApiError(error) &&
        error.kind === 'http' &&
        (error.status === 400 || error.status === 409)
      )
        throw new UserFacingError(safeProfileError(error.message));
      throw error;
    }
  },
};
