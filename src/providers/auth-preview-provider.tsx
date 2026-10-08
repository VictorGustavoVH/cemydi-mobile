import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  createAuthPreviewService,
  type AuthChallenge,
  type PreviewUser,
} from '@/features/auth/services/auth-preview-service';

function useAuthPreviewState() {
  const [service] = useState(createAuthPreviewService);
  const [challenge, setChallenge] = useState<AuthChallenge | null>(null);
  const [rememberedEmail, setRememberedEmail] = useState('');
  const [registrationDraft, setRegistrationDraft] = useState({ nombre: '', correo: '' });
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [user, setUser] = useState<PreviewUser | null>(null);
  const [authDestination, setAuthDestination] = useState<'/inicio' | '/carrito'>('/inicio');
  return useMemo(
    () => ({
      service,
      challenge,
      setChallenge,
      rememberedEmail,
      setRememberedEmail,
      registrationDraft,
      setRegistrationDraft,
      recoveryEmail,
      setRecoveryEmail,
      user,
      setUser,
      authDestination,
      setAuthDestination,
    }),
    [service, challenge, rememberedEmail, registrationDraft, recoveryEmail, user, authDestination],
  );
}
const AuthPreviewContext = createContext<ReturnType<typeof useAuthPreviewState> | null>(null);
export function AuthPreviewProvider({ children }: { children: ReactNode }) {
  const value = useAuthPreviewState();
  return <AuthPreviewContext.Provider value={value}>{children}</AuthPreviewContext.Provider>;
}
export function useAuthPreview() {
  const context = useContext(AuthPreviewContext);
  if (!context) throw new Error('useAuthPreview requiere AuthPreviewProvider');
  return context;
}
