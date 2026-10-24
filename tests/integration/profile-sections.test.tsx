import { useEffect, type ComponentType } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { render } from '../support/render-with-toast';
import { installNetworkMock } from '../support/network-mock';
import { installAuthApiMock, AUTH_ACCOUNT } from '../support/auth-api-mock';
import { installCartApiMock } from '../support/cart-api-mock';
import { installProfileApiMock } from '../support/profile-api-mock';
import { installAccountApiMock, RENTAL } from '../support/account-api-mock';
import { useAuth } from '@/providers/auth-provider';
import { CatalogPreviewProvider } from '@/providers/catalog-preview-provider';
import { RentalsScreen } from '@/features/profile/RentalsScreen';
import { RentalDetailScreen } from '@/features/profile/RentalDetailScreen';
import { MyReviewsScreen } from '@/features/profile/MyReviewsScreen';
import { HelpScreen } from '@/features/profile/HelpScreen';
import { LegalDocumentScreen } from '@/features/profile/LegalDocumentScreen';
import { accountService } from '@/features/profile/account-service';
import { ApiError } from '@/services/http/api-error';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: () => true,
  navigate: jest.fn(),
};
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/perfil',
  useLocalSearchParams: () => mockParams,
}));
let controls: ReturnType<typeof useAuth> & { client: QueryClient };
function Connected({ Screen }: { Screen: ComponentType }) {
  const auth = useAuth();
  const client = useQueryClient();
  useEffect(() => {
    controls = { ...auth, client };
  }, [auth, client]);
  useEffect(() => {
    void auth.service.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, false);
  }, [auth.service]);
  return <Screen />;
}
const show = (Screen: ComponentType) =>
  render(
    <CatalogPreviewProvider>
      <Connected Screen={Screen} />
    </CatalogPreviewProvider>,
  );
describe('Secciones de Perfil', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    installNetworkMock();
    installAuthApiMock();
    installCartApiMock();
    installProfileApiMock();
    installAccountApiMock();
  });
  it('consulta historial y abre el detalle exacto', async () => {
    await show(RentalsScreen);
    await fireEvent.press(await screen.findByLabelText('Ver renta REN-123'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/perfil/renta/[id]',
      params: { id: RENTAL.id },
    });
  });
  it('confirma la cancelación pendiente y muestra el resultado remoto', async () => {
    mockParams = { id: RENTAL.id };
    const server = installAccountApiMock();
    await show(RentalDetailScreen);
    await fireEvent.press(await screen.findByLabelText('Cancelar solicitud'));
    expect(server.read().status).toBe('PENDING');
    await fireEvent.press(screen.getByLabelText('Confirmar cancelación'));
    await waitFor(() => expect(screen.queryByLabelText('Cancelar solicitud')).toBeNull());
    expect(server.read().status).toBe('CANCELLED');
    expect(screen.getByText('Cancelada')).toBeTruthy();
  });
  it('no ofrece cancelación de una renta aprobada', async () => {
    mockParams = { id: RENTAL.id };
    installAccountApiMock({ ...RENTAL, status: 'APPROVED' });
    await show(RentalDetailScreen);
    await screen.findByText('Aprobada');
    expect(screen.queryByLabelText('Cancelar solicitud')).toBeNull();
  });
  it('no repuebla datos privados si cambia la sesión durante la cancelación', async () => {
    mockParams = { id: RENTAL.id };
    let finish!: (result: { message: string; rental: typeof RENTAL }) => void;
    const cancel = jest.spyOn(accountService, 'cancelRental').mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await show(RentalDetailScreen);
    await fireEvent.press(await screen.findByLabelText('Cancelar solicitud'));
    await fireEvent.press(screen.getByLabelText('Confirmar cancelación'));
    await fireEvent.press(screen.getByLabelText('Confirmar cancelación'));
    expect(cancel).toHaveBeenCalledTimes(1);
    await act(async () => {
      await controls.logout();
      finish({ message: 'Cancelada', rental: { ...RENTAL, status: 'CANCELLED' } });
    });
    expect(controls.client.getQueryData(['account', 1, 'rental', RENTAL.id])).toBeUndefined();
  });
  it('presenta errores y reintenta las lecturas', async () => {
    jest
      .spyOn(accountService, 'rentals')
      .mockRejectedValueOnce(new ApiError('Sin red', { kind: 'network' }));
    await show(RentalsScreen);
    await fireEvent.press(await screen.findByLabelText('Reintentar'));
    expect(await screen.findByLabelText('Ver renta REN-123')).toBeTruthy();
  });
  it('muestra las reseñas y permite ir al producto', async () => {
    await show(MyReviewsScreen);
    expect(await screen.findByText('Buena atención')).toBeTruthy();
    expect(screen.getByText('Publicada')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Ver producto: Equipo de prueba'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/producto/[id]',
      params: { id: '101' },
    });
  });
  it('muestra el documento real sin HTML ejecutable y valida la ruta', async () => {
    mockParams = { slug: 'politicas-de-privacidad' };
    const view = await show(LegalDocumentScreen);
    expect(await screen.findByText('Contenido legal & vigente.')).toBeTruthy();
    await view.unmount();
    mockParams = { slug: 'desconocido' };
    await show(LegalDocumentScreen);
    expect(await screen.findByText('Documento no disponible')).toBeTruthy();
  });
  it('abre los canales publicados y muestra un error si no hay aplicación compatible', async () => {
    const open = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('Sin app'));
    await show(HelpScreen);
    await fireEvent.press(screen.getByLabelText('Llamar a CEMYDI'));
    expect(open).toHaveBeenCalledWith('tel:7896880251');
    await fireEvent.press(screen.getByLabelText('Escribir a CEMYDI'));
    expect(await screen.findByText(/No se pudo abrir una aplicación/)).toBeTruthy();
  });
  it('devuelve al invitado a Inicio en lugar de mostrar una sección privada', async () => {
    await render(
      <CatalogPreviewProvider>
        <RentalsScreen />
      </CatalogPreviewProvider>,
    );
    await waitFor(() => expect(mockRouter.navigate).toHaveBeenCalledWith('/inicio'));
    expect(screen.queryByText('Inicia sesión para ver esta sección.')).toBeNull();
    expect(screen.queryByLabelText('Ir a inicio de sesión')).toBeNull();
  });
});
