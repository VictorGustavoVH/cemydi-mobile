import {
  createContext,
  useCallback,
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
import { authSession } from '@/features/auth/services/auth-session';
import { releaseNativePush } from '@/features/notifications/native-push';
import { configureHttpAuth } from '@/services/http/client';

function useAuthState(session: typeof authSession) {
  const queryClient = useQueryClient();
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [service] = useState(() => createAuthService(session));
  const [challenge, setChallenge] = useState<AuthChallenge | null>(null);
  const [rememberedEmail, setRememberedEmail] = useState('');
  const [registrationDraft, setRegistrationDraft] = useState({ nombre: '', correo: '' });
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const logoutDetailed = useCallback(() => {
    const userId = session.getSnapshot().user?.id;
    const completion = session.logout();
    const version = session.getVersion();
    const cleanup = releaseNativePush(
      userId,
      completion,
      () => session.getVersion() === version && !session.getSnapshot().user,
    );
    return Promise.all([completion, cleanup]).then(([result, pushStatus]) => ({
      ...result,
      pushStatus,
    }));
  }, [session]);
  const logout = useCallback(async () => {
    await logoutDetailed();
  }, [logoutDetailed]);
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
      logout,
      logoutDetailed,
      consumeExplicitLogout: session.consumeExplicitLogout,
      challenge,
      setChallenge,
      rememberedEmail,
      setRememberedEmail,
      registrationDraft,
      setRegistrationDraft,
      recoveryEmail,
      setRecoveryEmail,
    }),
    [
      service,
      state,
      session,
      logout,
      logoutDetailed,
      challenge,
      rememberedEmail,
      registrationDraft,
      recoveryEmail,
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
