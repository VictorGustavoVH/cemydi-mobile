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
import { ProfileEmailChangeScreen } from '@/features/profile/ProfileEmailChangeScreen';
import { profileService } from '@/features/profile/profile-service';
import { accountSecurityService } from '@/features/profile/account-security-service';
import { profileKey } from '@/features/profile/useProfile';
import { ApiError, UserFacingError } from '@/services/http/api-error';

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
const show = (Screen: ComponentType, login = true) =>
  render(
    <CatalogPreviewProvider>
      <Connected Screen={Screen} login={login} />
    </CatalogPreviewProvider>,
  );

describe('Perfil conectado', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installNetworkMock();
    installAuthApiMock();
    installProfileApiMock();
  });
  it('muestra identidad y accesos reales; devuelve al invitado a Inicio', async () => {
    const view = await show(ProfileScreen, false);
    await waitFor(() => expect(mockRouter.navigate).toHaveBeenCalledWith('/inicio'));
    expect(mockRouter.push).not.toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Inicia sesión para ver esta sección.')).toBeNull();
    await view.unmount();
    await show(ProfileScreen);
    expect(await screen.findByText(PROFILE_USER.nombre)).toBeTruthy();
    expect(await screen.findByLabelText('Datos personales')).toBeTruthy();
    expect(screen.getByText('Correo verificado')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Datos personales'));
    expect(mockRouter.push).toHaveBeenCalledWith('/perfil/editar');
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
    expect(screen.getByLabelText('Guardar cambios')).toBeDisabled();
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
    await show(ProfileSecurityScreen);
    await screen.findByLabelText('Contraseña actual');
    await waitFor(() => expect(controls.status).toBe('authenticated'));
    await fireEvent.changeText(screen.getByLabelText('Contraseña actual'), 'Actual123!');
    await fireEvent.press(screen.getByLabelText('Enviar código'));
    await screen.findByLabelText('Nueva contraseña');
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
  it('confirma el cierre de sesión y permite cancelar', async () => {
    await show(ProfileScreen);
    await screen.findByLabelText('Datos personales');
    await fireEvent.press(screen.getByLabelText('Cerrar sesión'));
    await fireEvent.press(screen.getByLabelText('Seguir en mi cuenta'));
    expect(controls.status).toBe('authenticated');
    await fireEvent.press(screen.getByLabelText('Cerrar sesión'));
    await fireEvent.press(screen.getByLabelText('Confirmar cierre de sesión'));
    await waitFor(() => expect(mockRouter.navigate).toHaveBeenCalledWith('/inicio'));
    expect(controls.user).toBeNull();
  });
});
