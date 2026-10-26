import { configureHttpAuth } from '@/services/http/client';
import { ApiError } from '@/services/http/api-error';
import { profileService } from '../profile-service';
import { profileChanges, profileFormSchema, profileResponseSchema } from '../profile-schemas';
import { PROFILE_USER, installProfileApiMock } from '../../../../tests/support/profile-api-mock';
import { jsonResponse } from '../../../../tests/support/auth-api-mock';

describe('Contrato y validación de perfil', () => {
  beforeEach(() =>
    configureHttpAuth({
      getAccessToken: () => 'fixture',
      getVersion: () => 1,
      refresh: async () => undefined,
      expired: async () => undefined,
    }),
  );
  it('normaliza campos y permite vaciar los datos opcionales sin restringir nombres internacionales', () => {
    const value = profileFormSchema.parse({
      nombre: ' 李 小明 ',
      telefono: '+52 (55) 1234-5678',
      direccion: ' Calle 1 ',
    });
    expect(value).toEqual({
      nombre: '李 小明',
      telefono: '+52 (55) 1234-5678',
      direccion: 'Calle 1',
    });
    expect(
      profileChanges(
        { ...value, nombre: PROFILE_USER.nombre, telefono: '', direccion: '' },
        PROFILE_USER,
      ),
    ).toEqual({});
    expect(
      profileChanges(
        { ...value, nombre: PROFILE_USER.nombre, telefono: '', direccion: '' },
        { ...PROFILE_USER, direccion: 'Anterior' },
      ),
    ).toEqual({ direccion: '' });
  });
  it.each([
    { nombre: ' ' },
    { nombre: '123' },
    { nombre: 'a'.repeat(121) },
    { telefono: '123' },
    { telefono: 'abcdefghij' },
    { telefono: '+1234567890123456' },
    { direccion: 'a'.repeat(181) },
  ])('rechaza un campo inválido: %j', (changes) => {
    expect(
      profileFormSchema.safeParse({
        nombre: 'Cliente',
        telefono: '',
        direccion: '',
        ...changes,
      }).success,
    ).toBe(false);
  });
  it('usa el contrato de perfil completo y solo envía los campos confirmados', async () => {
    installProfileApiMock();
    expect(await profileService.get()).toEqual(PROFILE_USER);
    await profileService.update({ nombre: 'Nombre nuevo', telefono: '' });
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://cemydi.test.invalid/users/me',
      expect.objectContaining({ cache: 'no-store', credentials: 'omit' }),
    );
    const options = jest.mocked(fetch).mock.calls[1][1]!;
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer fixture');
    expect(options).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ nombre: 'Nombre nuevo', telefono: '' }),
    });
    expect(
      profileResponseSchema.safeParse({ user: { ...PROFILE_USER, telefono: 55 } }).success,
    ).toBe(false);
  });
  it('propaga rechazo del servidor, null y respuestas inválidas sin falsear guardados', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: 'No hay campos para actualizar' }, 400));
    await expect(profileService.update({ nombre: 'Otro' })).rejects.toThrow(
      'No hay campos para actualizar',
    );
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: 'Detalle interno del servidor' }, 400));
    await expect(profileService.update({ nombre: 'Otro' })).rejects.toThrow(
      'No pudimos guardar los cambios. Revisa los datos e intenta de nuevo.',
    );
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ user: null }));
    await expect(profileService.get()).rejects.toThrow('No pudimos verificar tu cuenta');
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ user: PROFILE_USER }));
    await expect(profileService.update({ nombre: 'Nuevo' })).rejects.toMatchObject({
      kind: 'parse',
    });
    jest.mocked(fetch).mockRejectedValueOnce(new ApiError('Sin red', { kind: 'network' }));
    await expect(profileService.update({ nombre: 'Nuevo' })).rejects.toMatchObject({
      kind: 'network',
    });
  });
});
