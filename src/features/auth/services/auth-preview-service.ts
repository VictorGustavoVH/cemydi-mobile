import { RESEND_COOLDOWN_SECONDS } from '../schemas/auth-schemas';

// Local fixtures only. This service never sends credentials to the API.
export const DEFAULT_ACCOUNT = {
  nombre: 'Cliente CEMYDI',
  correo: 'cliente@cemydi.test',
  password: 'Cemydi2026!',
} as const;
const PREVIEW_CODE = '00000000';
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
    [DEFAULT_ACCOUNT.correo, { ...DEFAULT_ACCOUNT, verified: true }],
  ]);
  let challenge: AuthChallenge | null = null;
  const normalize = (correo: string) => correo.trim().toLowerCase();
  function begin(correo: string, purpose: AuthChallenge['purpose']) {
    if (challenge?.correo === normalize(correo) && challenge.resendAt > now()) {
      throw new Error('Espera antes de solicitar otro código.');
    }
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
      throw new Error('El código venció. Solicita uno nuevo.');
    }
    return challenge;
  }
  return {
    login(correo: string, password: string): PreviewUser {
      const account = accounts.get(normalize(correo));
      if (!account || account.password !== password) {
        throw new Error('El correo o la contraseña son incorrectos.');
      }
      if (!account.verified) throw new Error('Verifica tu correo antes de iniciar sesión.');
      return { nombre: account.nombre, correo: account.correo };
    },
    register(input: { nombre: string; correo: string; password: string }) {
      const correo = normalize(input.correo);
      if (accounts.get(correo)?.verified)
        throw new Error('No se pudo crear la cuenta con esos datos.');
      const next = begin(correo, 'registration');
      accounts.set(correo, { ...input, nombre: input.nombre.trim(), correo, verified: false });
      return next;
    },
    requestRecovery(correo: string) {
      return begin(correo, 'recovery');
    },
    resend() {
      if (!challenge) throw new Error('Primero solicita un código.');
      return begin(challenge.correo, challenge.purpose);
    },
    verify(codigo: string) {
      const current = activeChallenge();
      if (codigo !== PREVIEW_CODE)
        throw new Error('El código es incorrecto. Revisa los 8 dígitos.');
      if (current.purpose === 'registration') {
        const account = accounts.get(current.correo);
        if (!account) throw new Error('Solicita un código nuevo.');
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
        throw new Error('Primero verifica el código de recuperación.');
      }
      const account = accounts.get(current.correo);
      if (!account) throw new Error('No pudimos actualizar la contraseña. Revisa tu correo.');
      account.password = password;
      challenge = null;
    },
    cancelChallenge() {
      challenge = null;
    },
  };
}
