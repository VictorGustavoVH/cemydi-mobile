import { useCallback, useRef } from 'react';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { returnToAuthDestination } from '../return-to-auth-destination';
import { useProfile } from '@/features/profile';

/** The screen owns navigation, including Google sign-in, so it happens once. */
export function useAuthRedirect(pending = false) {
  const auth = useAuth();
  const { query: profile, isOnline } = useProfile();
  const router = useRouter();
  const navigation = useNavigation();
  const redirected = useRef(false);
  const { status } = auth;
  const resolvingProfile =
    !profile.data && !profile.isError && !profile.isPaused && isOnline !== false;
  const destination =
    profile.data?.telefono?.trim() && profile.data.direccion?.trim() ? '/inicio' : '/perfil';
  useFocusEffect(
    useCallback(
      () => () => {
        redirected.current = false;
      },
      [],
    ),
  );
  useFocusEffect(
    useCallback(() => {
      if (status !== 'authenticated') redirected.current = false;
      if (status !== 'authenticated' || pending || resolvingProfile || redirected.current) return;
      redirected.current = true;
      returnToAuthDestination(router, destination, navigation.getState());
    }, [status, pending, resolvingProfile, destination, router, navigation]),
  );
  return status === 'authenticated';
}
