import { ApiError, UserFacingError } from '@/services/http/api-error';
import { getGoogleAuthErrorMessage } from '../google-auth-error';

it('explica configuración y servicios de Google sin mostrar códigos ni mensajes nativos', () => {
  expect(
    getGoogleAuthErrorMessage({ code: 'DEVELOPER_ERROR', message: 'OAuth SHA-1 mismatch' }),
  ).toContain('no está disponible en esta versión');
  expect(
    getGoogleAuthErrorMessage({ code: 'PLAY_SERVICES_NOT_AVAILABLE', message: '17' }),
  ).toContain('Actualiza los servicios');
  expect(getGoogleAuthErrorMessage(new Error('Nitro module missing'))).not.toContain('Nitro');
});
it('distingue validación de Google, conectividad y errores seguros de sesión', () => {
  expect(
    getGoogleAuthErrorMessage(new ApiError('invalid audience', { kind: 'http', status: 401 })),
  ).toContain('validar tu cuenta de Google');
  expect(getGoogleAuthErrorMessage(new ApiError('network', { kind: 'network' }))).toContain(
    'conexión',
  );
  expect(getGoogleAuthErrorMessage(new UserFacingError('Vuelve a iniciar sesión.'))).toBe(
    'Vuelve a iniciar sesión.',
  );
});
