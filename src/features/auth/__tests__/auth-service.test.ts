import { createAuthService } from '../services/auth-service';
import { createAuthSession } from '../services/auth-session';
import {
  AUTH_ACCOUNT,
  installAuthApiMock,
  jsonResponse,
} from '../../../../tests/support/auth-api-mock';

function setup() {
  const session = createAuthSession({
    get: async () => null,
    set: async () => undefined,
    remove: async () => undefined,
  });
  return createAuthService(session);
}
describe('Contratos públicos de autenticación', () => {
  beforeEach(() => installAuthApiMock());
  it('registro envía exclusivamente los campos del DTO y verificación no inicia sesión', async () => {
    const service = setup();
    const challenge = await service.register({ ...AUTH_ACCOUNT, correo: ' CLIENTE@cemydi.test ' });
    expect(jest.mocked(fetch).mock.calls[0][1]).toMatchObject({
      credentials: 'omit',
      body: JSON.stringify(AUTH_ACCOUNT),
    });
    expect(challenge).toMatchObject({
      purpose: 'registration',
      correo: AUTH_ACCOUNT.correo,
      verified: false,
    });
    await expect(service.verify('00000000')).resolves.toBeNull();
    expect(jest.mocked(fetch).mock.calls[1][0]).toBe(
      'https://cemydi.test.invalid/auth/email-verification/confirm-code',
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('recuperación confirma con el mismo código validado sin exponerlo en el desafío', async () => {
    const service = setup();
    await service.requestRecovery(AUTH_ACCOUNT.correo);
    const challenge = await service.verify('00000000');
    expect(challenge).toMatchObject({ purpose: 'recovery', verified: true });
    expect(challenge).not.toHaveProperty('codigo');
    await service.resetPassword('NuevaPassword1!');
    expect(jest.mocked(fetch).mock.calls[2][1]).toMatchObject({
      body: JSON.stringify({
        correo: AUTH_ACCOUNT.correo,
        codigo: '00000000',
        newPassword: 'NuevaPassword1!',
      }),
    });
    await expect(service.resetPassword('OtraPassword1!')).rejects.toThrow(
      'Primero solicita un código',
    );
  });
  it('impide cambiar contraseña sin verificar y elimina el código al cancelar', async () => {
    const service = setup();
    await service.requestRecovery(AUTH_ACCOUNT.correo);
    await expect(service.resetPassword('NuevaPassword1!')).rejects.toThrow('Primero verifica');
    await service.verify('00000000');
    service.cancelChallenge();
    await expect(service.resetPassword('NuevaPassword1!')).rejects.toThrow('Primero solicita');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('no continúa ante código incorrecto, rate limiting o respuesta inválida', async () => {
    const service = setup();
    await service.requestRecovery(AUTH_ACCOUNT.correo);
    await expect(service.verify('12345678')).rejects.toThrow(
      'Los datos o el código son inválidos o expiraron.',
    );
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, 429));
    await expect(service.verify('00000000')).rejects.toThrow('demasiados intentos');
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'ok' }));
    await expect(service.verify('00000000')).rejects.toMatchObject({ kind: 'parse' });
    await expect(service.resetPassword('NuevaPassword1!')).rejects.toThrow('Primero verifica');
  });
  it('usa el vencimiento recibido del servidor y permite reenviar al terminar la espera', async () => {
    jest.useFakeTimers();
    try {
      const service = setup();
      await service.requestRecovery(AUTH_ACCOUNT.correo);
      await expect(service.resend()).rejects.toThrow('Espera');
      await service.verify('00000000');
      jest.advanceTimersByTime(300001);
      await expect(service.resetPassword('NuevaPassword1!')).rejects.toThrow('venció');
      const next = await service.resend();
      expect(next.verified).toBe(false);
      await expect(service.resetPassword('NuevaPassword1!')).rejects.toThrow('Primero verifica');
    } finally {
      jest.useRealTimers();
    }
  });
});
