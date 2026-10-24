import { AUTH_USER, jsonResponse } from './auth-api-mock';
import type { ProfileUser } from '@/features/profile/profile-schemas';

export const PROFILE_USER: ProfileUser = { ...AUTH_USER, telefono: null, direccion: null };
export function installProfileApiMock(initial: ProfileUser = PROFILE_USER) {
  let user = { ...initial };
  const previous = jest.mocked(fetch).getMockImplementation();
  jest.mocked(fetch).mockImplementation(async (input, options) => {
    if (new URL(String(input)).pathname !== '/users/me') {
      if (previous) return previous(input, options);
      throw new Error('Fetch sin fixture');
    }
    if (options?.method === 'PATCH') {
      const { password: _password, ...changes } = JSON.parse(String(options.body)) as Record<
        string,
        string
      >;
      user = {
        ...user,
        ...changes,
        telefono: changes.telefono === '' ? null : (changes.telefono ?? user.telefono),
        direccion: changes.direccion === '' ? null : (changes.direccion ?? user.direccion),
      };
      return jsonResponse({ message: 'Perfil actualizado correctamente', user });
    }
    return jsonResponse({ user });
  });
  return {
    read: () => user,
    change: (changes: Partial<ProfileUser>) => {
      user = { ...user, ...changes };
    },
  };
}
