import { UserFacingError } from '@/services/http/api-error';

import { RESEND_COOLDOWN_SECONDS } from '../schemas/auth-schemas';

// Local fixtures only. This service never sends credentials to the API.
export const DEFAULT_ACCOUNT = {
  nombre: 'Cliente CEMYDI',
  correo: 'cliente@cemydi.test',
  password: process.env.TEST_AUTH_PREVIEW_PASSWORD ?? '',
} as const;
const PREVIEW_CODE = process.env.TEST_AUTH_PREVIEW_OTP;
const MAX_OTP_ATTEMPTS = 5;
const CHALLENGE_LIFETIME_MS = 30 * 60 * 1000;

export type AuthChallenge = {
  correo: string;
  purpose: 'registration' | 'recovery';
  resendAt: number;
  expiresAt: number;
  verified: boolean;
};
type Account = { nombre: string; correo: string; password: string; verified: boolean };
export type PreviewUser = Pick<Account, 'nombre' | 'correo'>;

export function createAuthPreviewService(now = Date.now) {
  const accounts = new Map<string, Account>([
    ...(DEFAULT_ACCOUNT.password
      ? [[DEFAULT_ACCOUNT.correo, { ...DEFAULT_ACCOUNT, verified: true }] as const]
      : []),
  ]);
  let challenge: AuthChallenge | null = null;
  let attempts = 0;
  const normalize = (correo: string) => correo.trim().toLowerCase();
  function begin(correo: string, purpose: AuthChallenge['purpose']) {
    if (challenge?.correo === normalize(correo) && challenge.resendAt > now()) {
      throw new UserFacingError('Espera antes de solicitar otro código.');
    }
    attempts = 0;
    challenge = {
      correo: normalize(correo),
      purpose,
      resendAt: now() + RESEND_COOLDOWN_SECONDS * 1000,
      expiresAt: now() + CHALLENGE_LIFETIME_MS,
      verified: false,
    };
    return { ...challenge };
  }
  function activeChallenge() {
    if (!challenge || challenge.expiresAt <= now()) {
      throw new UserFacingError('El código venció. Solicita uno nuevo.');
    }
    return challenge;
  }
  return {
    login(correo: string, password: string): PreviewUser {
      const account = accounts.get(normalize(correo));
      if (!account || account.password !== password) {
        throw new UserFacingError('El correo o la contraseña son incorrectos.');
      }
      if (!account.verified)
        throw new UserFacingError('Verifica tu correo antes de iniciar sesión.');
      return { nombre: account.nombre, correo: account.correo };
    },
    register(input: { nombre: string; correo: string; password: string }) {
      const correo = normalize(input.correo);
      if (accounts.get(correo)?.verified)
        throw new UserFacingError('No se pudo crear la cuenta con esos datos.');
      const next = begin(correo, 'registration');
      accounts.set(correo, { ...input, nombre: input.nombre.trim(), correo, verified: false });
      return next;
    },
    requestRecovery(correo: string) {
      return begin(correo, 'recovery');
    },
    resend() {
      if (!challenge) throw new UserFacingError('Primero solicita un código.');
      return begin(challenge.correo, challenge.purpose);
    },
    verify(codigo: string) {
      const current = activeChallenge();
      if (attempts >= MAX_OTP_ATTEMPTS)
        throw new UserFacingError('Alcanzaste el límite de intentos. Solicita un código nuevo.');
      if (!PREVIEW_CODE || !/^\d{8}$/.test(PREVIEW_CODE))
        throw new UserFacingError('La verificación de muestra no está configurada.');
      attempts += 1;
      if (codigo !== PREVIEW_CODE)
        throw new UserFacingError('El código es incorrecto. Revisa los 8 dígitos.');
      if (current.purpose === 'registration') {
        const account = accounts.get(current.correo);
        if (!account) throw new UserFacingError('Solicita un código nuevo.');
        account.verified = true;
        challenge = null;
        return null;
      }
      challenge = { ...current, verified: true };
      return { ...challenge };
    },
    resetPassword(password: string) {
      const current = activeChallenge();
      if (current.purpose !== 'recovery' || !current.verified) {
        throw new UserFacingError('Primero verifica el código de recuperación.');
      }
      const account = accounts.get(current.correo);
      if (!account)
        throw new UserFacingError('No pudimos actualizar la contraseña. Revisa tu correo.');
      account.password = password;
      challenge = null;
    },
    cancelChallenge() {
      challenge = null;
    },
  };
}
