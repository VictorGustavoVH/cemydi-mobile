import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { createAuthService, type AuthChallenge } from '@/features/auth/services/auth-service';
import type { AuthDestination } from '@/features/auth/auth-destination';
import { authSession } from '@/features/auth/services/auth-session';
import { configureHttpAuth } from '@/services/http/client';

function useAuthState(session: typeof authSession) {
  const queryClient = useQueryClient();
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [service] = useState(() => createAuthService(session));
  const [challenge, setChallenge] = useState<AuthChallenge | null>(null);
  const [rememberedEmail, setRememberedEmail] = useState('');
  const [registrationDraft, setRegistrationDraft] = useState({ nombre: '', correo: '' });
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [authDestination, setAuthDestination] = useState<AuthDestination>('/inicio');
  useEffect(() => {
    configureHttpAuth({
      getAccessToken: session.getAccessToken,
      getVersion: session.getVersion,
      refresh: session.refresh,
      expired: session.expire,
    });
    let previousId = session.getSnapshot().user?.id;
    const unsubscribe = session.subscribe(() => {
      const id = session.getSnapshot().user?.id;
      if (previousId !== id) {
        void queryClient.cancelQueries();
        queryClient.clear();
        previousId = id;
      }
    });
    void session.restore();
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void session.revalidate().catch(() => undefined);
    });
    return () => {
      unsubscribe();
      subscription.remove();
      service.cancelChallenge();
    };
  }, [queryClient, service, session]);
  return useMemo(
    () => ({
      service,
      ...state,
      retrySession: session.restore,
      getSession: session.getSnapshot,
      getSessionVersion: session.getVersion,
      updateUser: session.updateUser,
      logout: async () => {
        await session.logout();
      },
      logoutDetailed: session.logout,
      consumeExplicitLogout: session.consumeExplicitLogout,
      challenge,
      setChallenge,
      rememberedEmail,
      setRememberedEmail,
      registrationDraft,
      setRegistrationDraft,
      recoveryEmail,
      setRecoveryEmail,
      authDestination,
      setAuthDestination,
    }),
    [
      service,
      state,
      session,
      challenge,
      rememberedEmail,
      registrationDraft,
      recoveryEmail,
      authDestination,
    ],
  );
}
const AuthContext = createContext<ReturnType<typeof useAuthState> | null>(null);
export function AuthProvider({
  children,
  session = authSession,
}: {
  children: ReactNode;
  session?: typeof authSession;
}) {
  const value = useAuthState(session);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth requiere AuthProvider');
  return context;
}
