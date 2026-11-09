import { useEffect, type ComponentType } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { render } from '../support/render-with-toast';
import { installAuthApiMock, AUTH_ACCOUNT } from '../support/auth-api-mock';
import { installProfileApiMock, PROFILE_USER } from '../support/profile-api-mock';
import { installNetworkMock } from '../support/network-mock';
import { useAuth } from '@/providers/auth-provider';
import { CatalogPreviewProvider } from '@/providers/catalog-preview-provider';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { EditProfileScreen } from '@/features/profile/EditProfileScreen';
import { ProfileSecurityScreen } from '@/features/profile/ProfileSecurityScreen';
import { ProfilePasswordChangeScreen } from '@/features/profile/ProfilePasswordChangeScreen';
import { ProfileEmailChangeScreen } from '@/features/profile/ProfileEmailChangeScreen';
import { profileService } from '@/features/profile/profile-service';
import { accountSecurityService } from '@/features/profile/account-security-service';
import { profileKey } from '@/features/profile/useProfile';
import { ApiError, UserFacingError } from '@/services/http/api-error';
import { Linking, Platform } from 'react-native';
import { allowScreenCaptureAsync, preventScreenCaptureAsync } from 'expo-screen-capture';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: () => true,
  navigate: jest.fn(),
};
const mockDispatch = jest.fn();
const mockPreventRemove = jest.fn();
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(callback, [callback]);
  },
  useRouter: () => mockRouter,
  usePathname: () => '/perfil',
  useNavigation: () => ({ dispatch: mockDispatch }),
}));
jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (...args: unknown[]) => mockPreventRemove(...args),
}));
let controls: ReturnType<typeof useAuth> & { client: QueryClient };
function Connected({ Screen, login = true }: { Screen: ComponentType; login?: boolean }) {
  const auth = useAuth();
  const client = useQueryClient();
  useEffect(() => {
    controls = { ...auth, client };
  }, [auth, client]);
  useEffect(() => {
    if (login) void auth.service.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, false);
  }, [auth.service, login]);
  return <Screen />;
}
const show = async (Screen: ComponentType, login = true, editing = true) => {
  const view = await render(
    <CatalogPreviewProvider>
      <Connected Screen={Screen} login={login} />
    </CatalogPreviewProvider>,
  );
  if (Screen === EditProfileScreen && editing) {
    await waitFor(() =>
      expect(
        screen.queryByLabelText('Modificar datos') ??
          screen.queryByText('No pudimos cargar la información'),
      ).toBeTruthy(),
    );
    if (screen.queryByLabelText('Modificar datos'))
      await fireEvent.press(screen.getByLabelText('Modificar datos'));
  }
  return view;
};

describe('Perfil conectado', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installNetworkMock();
    installAuthApiMock();
    installProfileApiMock();
  });
  it('abre privacidad y términos en el visor interno sin usar el navegador del sistema', async () => {
    const open = jest.spyOn(Linking, 'openURL');
    await show(ProfileScreen);
    await screen.findByText(PROFILE_USER.nombre);
    await fireEvent.press(screen.getByRole('button', { name: 'Política de privacidad' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/perfil/legal/politicas-de-privacidad');
    await fireEvent.press(screen.getByRole('button', { name: 'Términos y condiciones' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/perfil/legal/terminos-y-condiciones');
    expect(open).not.toHaveBeenCalled();
  });
  it('espera protección Android antes de mostrar datos personales y la libera al salir', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    let protect!: () => void;
    jest.mocked(preventScreenCaptureAsync).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        protect = resolve;
      }),
    );
    const view = await show(EditProfileScreen, true, false);
    await waitFor(() => expect(controls.status).toBe('authenticated'));
    expect(preventScreenCaptureAsync).toHaveBeenCalledTimes(1);
    const key = jest.mocked(preventScreenCaptureAsync).mock.calls[0]![0];
    expect(screen.queryByLabelText('Teléfono (opcional)')).toBeNull();
    expect(screen.queryByLabelText('Dirección (opcional)')).toBeNull();
    await act(async () => protect());
    await screen.findByLabelText('Teléfono (opcional)');
    expect(screen.getByLabelText('Dirección (opcional)')).toBeTruthy();
    expect(allowScreenCaptureAsync).not.toHaveBeenCalled();
    await view.unmount();
    await waitFor(() => expect(allowScreenCaptureAsync).toHaveBeenCalledWith(key));
  });
  it('el encabezado permite volver a Inicio y abre los ajustes de notificaciones desde el engrane', async () => {
    await show(ProfileScreen);
    await screen.findByText(PROFILE_USER.nombre);
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir ajustes de notificaciones' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/perfil/notificaciones/preferencias');
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/inicio');
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
  it('muestra identidad y accesos reales; devuelve al invitado a Inicio', async () => {
    const view = await show(ProfileScreen, false);
    await waitFor(() => expect(mockRouter.navigate).toHaveBeenCalledWith('/inicio'));
    expect(mockRouter.push).not.toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Inicia sesión para ver esta sección.')).toBeNull();
    await view.unmount();
    installProfileApiMock({ ...PROFILE_USER, direccion: 'Calle privada 123' });
    await show(ProfileScreen);
    expect(await screen.findByText(PROFILE_USER.nombre)).toBeTruthy();
    expect(await screen.findByLabelText('Datos personales')).toBeTruthy();
    expect(screen.getByText('Correo verificado')).toBeTruthy();
    expect(screen.getByText('Consulta y actualiza tu dirección de contacto')).toBeTruthy();
    await waitFor(() =>
      expect(
        controls.client.getQueryData<{ direccion: string }>(profileKey(PROFILE_USER.id))?.direccion,
      ).toBe('Calle privada 123'),
    );
    expect(screen.queryByText('Calle privada 123')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Datos personales'));
    expect(mockRouter.push).toHaveBeenCalledWith('/perfil/editar');
  });
  it('mantiene las opciones del menú mientras se consulta el perfil', async () => {
    jest.spyOn(profileService, 'get').mockReturnValueOnce(new Promise<never>(() => undefined));
    await show(ProfileScreen);
    expect(await screen.findByText(PROFILE_USER.nombre)).toBeTruthy();
    expect(screen.getByLabelText('Datos personales')).toBeTruthy();
    expect(screen.getByLabelText('Mis rentas')).toBeTruthy();
  });
  it('mantiene las opciones y avisa en el contenido cuando no hay conexión', async () => {
    const network = installNetworkMock();
    jest.spyOn(profileService, 'get').mockReturnValueOnce(new Promise<never>(() => undefined));
    await show(ProfileScreen);
    await screen.findByText(PROFILE_USER.nombre);
    await act(async () => {
      network.emit({ isInternetReachable: false });
    });
    expect(screen.getByLabelText('Datos personales')).toBeTruthy();
    expect(screen.getByLabelText('Mis rentas')).toBeTruthy();
    expect(screen.getByText(/Mostramos la información de tu sesión/)).toBeTruthy();
  });
  it('muestra los datos guardados y solo permite editarlos al pulsar Modificar; Cancelar descarta el borrador', async () => {
    const save = jest.spyOn(profileService, 'update');
    await show(EditProfileScreen, true, false);
    await screen.findByDisplayValue(PROFILE_USER.nombre);
    const nameField = screen.getByLabelText('Nombre completo');
    const fieldId = nameField.props.nativeID;
    expect(nameField).toHaveProp('editable', false);
    expect(screen.getByLabelText('Teléfono (opcional)')).toHaveProp('editable', false);
    expect(screen.getByLabelText('Dirección (opcional)')).toHaveProp('editable', false);
    await fireEvent.press(screen.getByLabelText('Modificar datos'));
    expect(screen.getByLabelText('Nombre completo')).toHaveProp('editable', true);
    expect(screen.getByLabelText('Nombre completo').props.nativeID).toBe(fieldId);
    await fireEvent.changeText(screen.getByLabelText('Nombre completo'), 'Borrador');
    await fireEvent.press(screen.getByLabelText('Cancelar'));
    expect(screen.getByDisplayValue(PROFILE_USER.nombre)).toBeTruthy();
    expect(screen.getByLabelText('Nombre completo')).toHaveProp('editable', false);
    expect(screen.getByLabelText('Nombre completo').props.nativeID).toBe(fieldId);
    expect(screen.queryByDisplayValue('Borrador')).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });
  it('guarda solo cambios y actualiza inmediatamente la identidad de sesión', async () => {
    const save = jest.spyOn(profileService, 'update');
    await show(EditProfileScreen);
    await screen.findByDisplayValue(PROFILE_USER.nombre);
    expect(screen.getByLabelText('Guardar cambios')).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Nombre completo'), '  Nombre actualizado  ');
    await fireEvent.changeText(screen.getByLabelText('Teléfono (opcional)'), '+52 55 1234 5678');
    await fireEvent.press(screen.getByLabelText('Guardar cambios'));
    await screen.findByText('Tus datos se guardaron correctamente');
    expect(save).toHaveBeenCalledWith({
      nombre: 'Nombre actualizado',
      telefono: '+52 55 1234 5678',
    });
    expect(controls.user?.nombre).toBe('Nombre actualizado');
    expect(screen.getByDisplayValue('Nombre actualizado')).toBeTruthy();
    expect(screen.getByLabelText('Nombre completo')).toHaveProp('editable', false);
    expect(screen.queryByLabelText('Guardar cambios')).toBeNull();
  });
  it('valida teléfono antes de enviar y separa el cambio de correo', async () => {
    const save = jest.spyOn(profileService, 'update');
    await show(EditProfileScreen);
    await screen.findByDisplayValue(PROFILE_USER.nombre);
    await fireEvent.press(screen.getByLabelText('Cambiar correo con código'));
    expect(mockRouter.push).toHaveBeenCalledWith('/perfil/cambiar-correo');
    await fireEvent.changeText(screen.getByLabelText('Teléfono (opcional)'), 'abc');
    await fireEvent.press(screen.getByLabelText('Guardar cambios'));
    expect(screen.getByText('Escribe un teléfono válido de 7 a 15 dígitos')).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Teléfono (opcional)'), '');
    await fireEvent.changeText(screen.getByLabelText('Nombre completo'), 'Nuevo nombre');
    save.mockRejectedValueOnce(new UserFacingError('No pudimos guardar el perfil'));
    await fireEvent.press(screen.getByLabelText('Guardar cambios'));
    expect(await screen.findByText('No pudimos guardar el perfil')).toBeTruthy();
    expect(controls.user?.correo).toBe(PROFILE_USER.correo);
  });
  it('Seguridad muestra dos accesos independientes sin mezclar los formularios', async () => {
    await show(ProfileSecurityScreen);
    await waitFor(() => expect(controls.status).toBe('authenticated'));
    expect(screen.queryByLabelText('Contraseña actual')).toBeNull();
    expect(screen.queryByLabelText('Código de verificación de 8 dígitos')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/perfil/cambiar-contrasena');
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar mi cuenta' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/perfil/eliminar-cuenta');
  });
  it('no sustituye el borrador cuando llega una actualización del servidor', async () => {
    const server = installProfileApiMock();
    await show(EditProfileScreen);
    await screen.findByDisplayValue(PROFILE_USER.nombre);
    await fireEvent.changeText(screen.getByLabelText('Nombre completo'), 'Mi borrador');
    server.change({ nombre: 'Desde la web', direccion: 'Dirección actualizada' });
    await act(async () => {
      await controls.client.invalidateQueries({ queryKey: profileKey(PROFILE_USER.id) });
    });
    expect(screen.getByDisplayValue('Mi borrador')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Guardar cambios'));
    await screen.findByText('Tus datos se guardaron correctamente');
    expect(server.read().direccion).toBe('Dirección actualizada');
  });
  it('conserva los datos consultados offline y bloquea el guardado', async () => {
    const network = installNetworkMock();
    await show(EditProfileScreen);
    await screen.findByDisplayValue(PROFILE_USER.nombre);
    await fireEvent.changeText(screen.getByLabelText('Nombre completo'), 'Nombre nuevo');
    await act(async () => {
      network.emit({ isInternetReachable: false });
    });
    expect(screen.getByText(/Sin conexión. Puedes consultar/)).toBeTruthy();
    expect(screen.getByLabelText('Guardar cambios')).toBeDisabled();
    expect(screen.getByDisplayValue('Nombre nuevo')).toBeTruthy();
  });
  it('presenta carga/error y permite reintentar sin inventar datos de contacto', async () => {
    jest
      .spyOn(profileService, 'get')
      .mockRejectedValueOnce(new ApiError('Red', { kind: 'network' }));
    await show(EditProfileScreen);
    await screen.findByText('No pudimos cargar la información');
    expect(screen.queryByLabelText('Nombre completo')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Reintentar'));
    await fireEvent.press(await screen.findByLabelText('Modificar datos'));
    expect(await screen.findByDisplayValue(PROFILE_USER.nombre)).toBeTruthy();
  });
  it('bloquea el envío repetido y descarta una respuesta de otra sesión', async () => {
    let finish!: (value: typeof PROFILE_USER) => void;
    const update = jest.spyOn(profileService, 'update').mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await show(EditProfileScreen);
    await screen.findByDisplayValue(PROFILE_USER.nombre);
    await fireEvent.changeText(screen.getByLabelText('Nombre completo'), 'Nuevo nombre');
    const button = screen.getByLabelText('Guardar cambios');
    await fireEvent.press(button);
    await fireEvent.press(button);
    expect(update).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    await act(async () => {
      await controls.logout();
      finish({ ...PROFILE_USER, nombre: 'Nuevo nombre' });
    });
    await waitFor(() => expect(controls.status).toBe('guest'));
    expect(controls.client.getQueryData(profileKey(PROFILE_USER.id))).toBeUndefined();
    expect(screen.queryByDisplayValue('Nuevo nombre')).toBeNull();
  });
  it('ofrece continuar editando o descartar ante una navegación con cambios', async () => {
    await show(EditProfileScreen);
    await screen.findByDisplayValue(PROFILE_USER.nombre);
    await fireEvent.changeText(screen.getByLabelText('Nombre completo'), 'Borrador');
    const [, prevent] = mockPreventRemove.mock.calls.at(-1)!;
    const action = { type: 'GO_BACK' };
    await act(async () => {
      prevent({ data: { action } });
    });
    expect(screen.getByText('¿Salir sin guardar?')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Seguir editando'));
    expect(mockDispatch).not.toHaveBeenCalled();
    await act(async () => {
      prevent({ data: { action } });
    });
    await fireEvent.press(screen.getByLabelText('Descartar cambios'));
    expect(mockDispatch).toHaveBeenCalledWith(action);
  });
  it('requiere contraseña actual y OTP para cambiar la contraseña', async () => {
    const request = jest.spyOn(accountSecurityService, 'requestPasswordChange').mockResolvedValue({
      message: 'Código enviado',
      resendAt: new Date(Date.now() + 60_000).toISOString(),
      expiresAt: new Date(Date.now() + 1_800_000).toISOString(),
    });
    const confirm = jest.spyOn(accountSecurityService, 'confirmPasswordChange').mockResolvedValue({
      message: 'Actualizada',
    });
    await show(ProfilePasswordChangeScreen);
    await screen.findByLabelText('Contraseña actual');
    expect(screen.getByLabelText('Contraseña actual')).toHaveProp('maxLength', 72);
    expect(screen.queryByRole('button', { name: 'Eliminar mi cuenta' })).toBeNull();
    await waitFor(() => expect(controls.status).toBe('authenticated'));
    await fireEvent.changeText(screen.getByLabelText('Contraseña actual'), 'Actual123!');
    await fireEvent.press(screen.getByLabelText('Enviar código'));
    await screen.findByLabelText('Nueva contraseña');
    expect(screen.getByLabelText('Nueva contraseña')).toHaveProp('maxLength', 72);
    expect(screen.getByLabelText('Confirmar nueva contraseña')).toHaveProp('maxLength', 72);
    expect(request).toHaveBeenCalledWith('Actual123!');
    await fireEvent.changeText(
      screen.getByLabelText('Código de verificación de 8 dígitos'),
      '12345678',
    );
    await fireEvent.changeText(screen.getByLabelText('Nueva contraseña'), 'Segura1234!');
    await fireEvent.changeText(screen.getByLabelText('Confirmar nueva contraseña'), 'Diferente1!');
    await fireEvent.press(screen.getByLabelText('Actualizar contraseña'));
    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeTruthy();
    expect(confirm).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Confirmar nueva contraseña'), 'Segura1234!');
    await fireEvent.press(screen.getByLabelText('Actualizar contraseña'));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith('12345678', 'Segura1234!'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/login'));
    expect(
      JSON.stringify(controls.client.getQueryData(profileKey(PROFILE_USER.id))) ?? '',
    ).not.toContain('Segura1234!');
  });
  it.each(['correo', 'contraseña'] as const)(
    'una confirmación tardía de %s no cierra una sesión nueva',
    async (mode) => {
      const challenge = {
        message: 'Enviado',
        resendAt: new Date(Date.now() + 60000).toISOString(),
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      };
      let finish!: (result: { message: string }) => void;
      const response = new Promise<{ message: string }>((resolve) => {
        finish = resolve;
      });
      jest.spyOn(accountSecurityService, 'requestEmailChange').mockResolvedValue(challenge);
      jest.spyOn(accountSecurityService, 'requestPasswordChange').mockResolvedValue(challenge);
      jest.spyOn(accountSecurityService, 'confirmEmailChange').mockReturnValue(response);
      jest.spyOn(accountSecurityService, 'confirmPasswordChange').mockReturnValue(response);
      await show(mode === 'correo' ? ProfileEmailChangeScreen : ProfilePasswordChangeScreen);
      await screen.findByLabelText('Contraseña actual');
      await waitFor(() => expect(controls.status).toBe('authenticated'));
      if (mode === 'correo')
        await fireEvent.changeText(
          screen.getByLabelText('Nuevo correo electrónico'),
          'nuevo@example.com',
        );
      await fireEvent.changeText(screen.getByLabelText('Contraseña actual'), 'Actual123!');
      await fireEvent.press(screen.getByLabelText('Enviar código'));
      await fireEvent.changeText(
        await screen.findByLabelText('Código de verificación de 8 dígitos'),
        '12345678',
      );
      if (mode === 'contraseña') {
        await fireEvent.changeText(screen.getByLabelText('Nueva contraseña'), 'Segura1234!');
        await fireEvent.changeText(
          screen.getByLabelText('Confirmar nueva contraseña'),
          'Segura1234!',
        );
      }
      await fireEvent.press(
        screen.getByLabelText(mode === 'correo' ? 'Confirmar correo' : 'Actualizar contraseña'),
      );
      await act(async () => {
        await controls.service.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, false);
      });
      await act(async () => {
        finish({ message: 'Actualizada' });
      });
      expect(controls.status).toBe('authenticated');
      expect(mockRouter.replace).not.toHaveBeenCalledWith('/login');
    },
  );
  it('mantiene el correo anterior hasta confirmar el OTP del correo nuevo', async () => {
    const request = jest.spyOn(accountSecurityService, 'requestEmailChange').mockResolvedValue({
      message: 'Código enviado',
      resendAt: new Date(Date.now() + 60_000).toISOString(),
      expiresAt: new Date(Date.now() + 1_800_000).toISOString(),
    });
    const confirm = jest.spyOn(accountSecurityService, 'confirmEmailChange').mockResolvedValue({
      message: 'Actualizado',
    });
    await show(ProfileEmailChangeScreen);
    await screen.findByLabelText('Nuevo correo electrónico');
    await waitFor(() => expect(controls.status).toBe('authenticated'));
    await fireEvent.changeText(
      screen.getByLabelText('Nuevo correo electrónico'),
      'Nuevo@Example.com',
    );
    await fireEvent.changeText(screen.getByLabelText('Contraseña actual'), 'Actual123!');
    await fireEvent.press(screen.getByLabelText('Enviar código'));
    expect(await screen.findByText('Código enviado a nuevo@example.com')).toBeTruthy();
    expect(request).toHaveBeenCalledWith('nuevo@example.com', 'Actual123!');
    expect(controls.user?.correo).toBe(PROFILE_USER.correo);
    await fireEvent.changeText(
      screen.getByLabelText('Código de verificación de 8 dígitos'),
      '12345678',
    );
    await fireEvent.press(screen.getByLabelText('Confirmar correo'));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith('nuevo@example.com', '12345678'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/login'));
    expect(controls.user).toBeNull();
  });
  it('confirma el cierre de sesión con el diálogo de CEMYDI y permite cancelar', async () => {
    await show(ProfileScreen);
    await screen.findByLabelText('Datos personales');
    await waitFor(() => expect(controls.status).toBe('authenticated'));
    mockRouter.navigate.mockClear();
    await fireEvent.press(screen.getByLabelText('Cerrar sesión'));
    expect(screen.getByText('¿Cerrar sesión?')).toBeTruthy();
    expect(controls.status).toBe('authenticated');
    await fireEvent.press(screen.getByLabelText('Cancelar'));
    expect(screen.queryByText('¿Cerrar sesión?')).toBeNull();
    expect(controls.status).toBe('authenticated');
    await fireEvent.press(screen.getByLabelText('Cerrar sesión'));
    await fireEvent.press(screen.getByLabelText('Salir'));
    await waitFor(() => expect(mockRouter.navigate).toHaveBeenCalledWith('/inicio'));
    expect(controls.user).toBeNull();
  });
});
