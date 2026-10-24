import { useCallback, useRef, type ReactNode } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { AppScreen } from '@/components/ui/AppScreen';
import { BackButton } from '@/components/ui/BackButton';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { useAuth } from '@/providers/auth-provider';
import { LogoutStorageError } from '@/features/auth/services/auth-session';
import { useToast } from '@/hooks/useToast';

type ProfileLayoutProps = {
  title: string;
  titleAccessory?: ReactNode;
  children: ReactNode;
  main?: boolean;
  action?: ReactNode;
  publicAccess?: boolean;
  scroll?: boolean;
};
export function ProfileLayout({
  title,
  titleAccessory,
  children,
  main = false,
  action,
  publicAccess = false,
  scroll = true,
}: ProfileLayoutProps) {
  const { status, user, error, retrySession, logoutDetailed, consumeExplicitLogout } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const redirecting = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (publicAccess || status === 'loading' || status === 'error') return;
      if (status === 'authenticated' && user) {
        redirecting.current = false;
        return;
      }
      if (redirecting.current) return;
      redirecting.current = true;
      // Un invitado nunca se queda en una sección privada: vuelve a Inicio en
      // lugar de mostrar una pantalla intermedia sin salida (por ejemplo al
      // volver con «Atrás» desde el inicio de sesión o al vencer la sesión).
      if (consumeExplicitLogout?.()) return;
      toast.info('Inicia sesión para continuar');
      router.navigate('/inicio');
    }, [publicAccess, status, user, consumeExplicitLogout, router, toast]),
  );
  return (
    <AppScreen
      scroll={scroll}
      edges={main ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
    >
      <View className="flex-row items-center gap-3 bg-background px-5 py-2">
        <BackButton
          fallbackHref={main ? '/inicio' : '/perfil'}
          onPress={
            main
              ? () => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.navigate('/inicio');
                  }
                }
              : undefined
          }
        />
        <View className="min-w-0 flex-1 flex-row items-center justify-center gap-2">
          <Text
            accessibilityRole="header"
            className="min-w-0 shrink text-center font-sans-semibold text-xl text-primary"
          >
            {title}
          </Text>
          {titleAccessory}
        </View>
        {user && status === 'authenticated' && action ? action : <View className="w-11" />}
      </View>
      {publicAccess ? (
        children
      ) : status === 'loading' ? (
        <LoadingState label="Comprobando tu sesión…" />
      ) : status === 'error' ? (
        error instanceof LogoutStorageError ? (
          <ErrorState
            title="No pudimos confirmar el cierre de sesión"
            onRetry={() =>
              void logoutDetailed()
                .then(() => router.navigate('/inicio'))
                .catch(() => undefined)
            }
          />
        ) : (
          <ErrorState title="No pudimos comprobar tu sesión" onRetry={() => void retrySession()} />
        )
      ) : !user || status !== 'authenticated' ? (
        <LoadingState label="Volviendo al inicio…" />
      ) : (
        children
      )}
    </AppScreen>
  );
}
