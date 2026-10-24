import { UserFacingError } from '@/services/http/api-error';
import { RESEND_COOLDOWN_SECONDS } from '../schemas/auth-schemas';
import { authMessageSchema, verifiedCodeSchema } from '../schemas/auth-api-schemas';
import { authPost } from './auth-api';
import { authSession } from './auth-session';

export type AuthChallenge = {
  correo: string;
  purpose: 'registration' | 'recovery';
  resendAt: number;
  expiresAt?: number;
  verified: boolean;
};

export function createAuthService(session = authSession) {
  let challenge: AuthChallenge | null = null;
  let recoveryCode: string | null = null;
  let revision = 0;
  const begin = (correo: string, purpose: AuthChallenge['purpose']) => {
    recoveryCode = null;
    challenge = {
      correo: correo.trim().toLowerCase(),
      purpose,
      resendAt: Date.now() + RESEND_COOLDOWN_SECONDS * 1000,
      verified: false,
    };
    return { ...challenge };
  };
  function current() {
    if (!challenge) throw new UserFacingError('Primero solicita un código.');
    return challenge;
  }
  return {
    login: session.login,
    loginWithGoogle: session.loginWithGoogle,
    async register(input: { nombre: string; correo: string; password: string }) {
      ++revision;
      await authPost(
        '/auth/register',
        {
          nombre: input.nombre.trim(),
          correo: input.correo.trim().toLowerCase(),
          password: input.password,
        },
        authMessageSchema,
      );
      return begin(input.correo, 'registration');
    },
    async requestRecovery(correo: string) {
      ++revision;
      await authPost(
        '/auth/password-reset/request',
        { correo: correo.trim().toLowerCase() },
        authMessageSchema,
      );
      return begin(correo, 'recovery');
    },
    async requestVerification(correo: string) {
      ++revision;
      await authPost(
        '/auth/email-verification/send',
        { correo: correo.trim().toLowerCase() },
        authMessageSchema,
      );
      return begin(correo, 'registration');
    },
    async resend() {
      const active = current();
      if (Date.now() < active.resendAt)
        throw new UserFacingError('Espera antes de solicitar otro código.');
      await authPost(
        active.purpose === 'registration'
          ? '/auth/email-verification/send'
          : '/auth/password-reset/request',
        { correo: active.correo },
        authMessageSchema,
      );
      ++revision;
      return begin(active.correo, active.purpose);
    },
    async verify(codigo: string) {
      const active = current();
      const expected = revision;
      if (active.purpose === 'registration') {
        await authPost(
          '/auth/email-verification/confirm-code',
          { correo: active.correo, codigo },
          authMessageSchema,
        );
        if (expected !== revision) throw new UserFacingError('La verificación fue cancelada.');
        challenge = null;
        return null;
      }
      const result = await authPost(
        '/auth/password-reset/verify-code',
        { correo: active.correo, codigo },
        verifiedCodeSchema,
      );
      if (expected !== revision) throw new UserFacingError('La verificación fue cancelada.');
      recoveryCode = codigo;
      challenge = { ...active, verified: true, expiresAt: Date.parse(result.expiresAt) };
      return { ...challenge };
    },
    async resetPassword(newPassword: string) {
      const active = current();
      if (active.purpose !== 'recovery' || !active.verified || !recoveryCode) {
        throw new UserFacingError('Primero verifica el código de recuperación.');
      }
      if (active.expiresAt && active.expiresAt <= Date.now()) {
        recoveryCode = null;
        throw new UserFacingError('El código venció. Solicita uno nuevo.');
      }
      await authPost(
        '/auth/password-reset/confirm',
        { correo: active.correo, codigo: recoveryCode, newPassword },
        authMessageSchema,
      );
      recoveryCode = null;
      challenge = null;
      await session.clear();
    },
    cancelChallenge() {
      revision += 1;
      challenge = null;
      recoveryCode = null;
    },
  };
}
