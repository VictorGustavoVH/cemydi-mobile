import { getFriendlyErrorMessage, isApiError } from '@/services/http/api-error';

export function getGoogleAuthErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (code === 'PLAY_SERVICES_NOT_AVAILABLE')
    return 'Actualiza los servicios de Google Play para continuar o inicia sesión con tu correo.';
  if (code === 'DEVELOPER_ERROR' || code === '10')
    return 'El acceso con Google no está disponible en esta versión. Puedes usar tu correo y contraseña.';
  if (code === 'IN_PROGRESS')
    return 'Espera a que termine el acceso con Google e intenta de nuevo.';
  if (code === 'SIGN_IN_CANCELLED')
    return 'Google no completó el acceso. Intenta de nuevo cuando quieras.';
  if (isApiError(error) && [400, 401, 403].includes(error.status ?? 0))
    return 'No pudimos validar tu cuenta de Google. Intenta de nuevo o inicia sesión con tu correo.';
  return getFriendlyErrorMessage(
    error,
    'No pudimos iniciar sesión con Google. Intenta de nuevo o usa tu correo y contraseña.',
  );
}
