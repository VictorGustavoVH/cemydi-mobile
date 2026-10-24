import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { authUserSchema } from '@/features/auth/schemas/auth-api-schemas';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { UserFacingError } from '@/services/http/api-error';
import { profileService } from './profile-service';
import type { UpdateProfilePayload } from './profile-schemas';

export const profileKey = (id: number | undefined) => ['profile', id] as const;
export function useProfile() {
  const { user, status, getSession, getSessionVersion, updateUser } = useAuth();
  const { isOnline } = useNetworkStatus();
  const id = status === 'authenticated' ? user?.id : undefined;
  const client = useQueryClient();
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const query = useQuery({
    queryKey: profileKey(id),
    queryFn: async ({ signal }) => {
      const profile = await profileService.get(signal);
      if (profile.id !== id)
        throw new UserFacingError('La sesión cambió. Vuelve a abrir tu perfil.');
      return profile;
    },
    enabled: id !== undefined && !saving,
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    gcTime: 0,
    retry: false,
  });
  async function save(payload: UpdateProfilePayload) {
    if (lock.current) throw new UserFacingError('Espera a que termine el guardado.');
    if (id === undefined) throw new UserFacingError('Inicia sesión para editar tu perfil.');
    if (isOnline === false)
      throw new UserFacingError('Conéctate a internet para guardar los cambios.');
    const version = getSessionVersion();
    const isCurrent = () => getSessionVersion() === version && getSession().user?.id === id;
    lock.current = true;
    setSaving(true);
    try {
      await client.cancelQueries({ queryKey: profileKey(id) });
      if (!isCurrent()) throw new UserFacingError('La sesión cambió. Vuelve a abrir tu perfil.');
      const result = await profileService.update(payload);
      if (!isCurrent() || result.id !== id)
        throw new UserFacingError('La sesión cambió. Vuelve a abrir tu perfil.');
      await client.cancelQueries({ queryKey: profileKey(id) });
      if (!isCurrent()) throw new UserFacingError('La sesión cambió. Vuelve a abrir tu perfil.');
      updateUser(authUserSchema.parse(result), version);
      client.setQueryData(profileKey(id), result);
      return result;
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  return { query, save, saving, isOnline, user, status };
}
