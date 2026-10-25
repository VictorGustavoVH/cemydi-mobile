import { useEffect } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  focusManager,
  onlineManager,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { CART_SYNC_INTERVAL_MS } from '@/providers/cart-provider';
import { render } from '../support/render-with-toast';
import { AUTH_ACCOUNT, installAuthApiMock } from '../support/auth-api-mock';
import {
  CART_RESPONSE,
  CART_LINE,
  RENTAL_LINE,
  installCartApiMock,
} from '../support/cart-api-mock';
import { useAuth } from '@/providers/auth-provider';
import { useCatalogPreview } from '@/providers/catalog-preview-provider';
import { CatalogPreviewProvider } from '../support/catalog-cart-provider';
import { ApiError, UserFacingError } from '@/services/http/api-error';
import { CartPreviewScreen } from '@/features/cart/CartPreviewScreen';
import { cartService } from '@/features/cart/services/cart-service';
import { ProductDetailScreen } from '@/features/products/ProductDetailScreen';
import { toCartEntry } from '@/features/cart/services/cart-adapter';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
    canGoBack: () => true,
    back: jest.fn(),
  }),
}));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn().mockResolvedValue(undefined) }));
let controls: { logout: () => Promise<void>; client: QueryClient };
function ConnectedCart({ detail = false }: { detail?: boolean }) {
  const { service, logout } = useAuth();
  const client = useQueryClient();
  useEffect(() => {
    controls = { logout, client };
  }, [logout, client]);
  useEffect(() => {
    void service.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, false);
  }, [service]);
  return detail ? (
    <ProductDetailScreen
      productId="101"
      suppliedProduct={toCartEntry(RENTAL_LINE).product}
      initialMode="rental"
    />
  ) : (
    <CartPreviewScreen />
  );
}
const show = () =>
  render(
    <CatalogPreviewProvider>
      <ConnectedCart />
    </CatalogPreviewProvider>,
  );
function GuestProduct() {
  const { addItem } = useCatalogPreview();
  useEffect(() => {
    addItem('101', 'purchase');
  }, [addItem]);
  return null;
}
describe('Carrito conectado', () => {
  beforeEach(() => {
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
    installAuthApiMock();
    installCartApiMock();
  });
  afterEach(async () => {
    await act(async () => {
      onlineManager.setOnline(true);
      focusManager.setFocused(true);
    });
    jest.useRealTimers();
  });
  it('usa totales del servidor y confirma cantidades, eliminación y deshacer', async () => {
    await show();
    expect(await screen.findByText('Total: $1,000.00 MXN')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Aumentar cantidad de Silla de ruedas, compra'));
    await waitFor(() =>
      expect(screen.getByLabelText('Cantidad de Silla de ruedas, compra: 3')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByLabelText('Eliminar Silla de ruedas, compra'));
    await waitFor(() =>
      expect(screen.queryByLabelText('Cantidad de Silla de ruedas, compra: 3')).toBeNull(),
    );
    await fireEvent.press(await screen.findByLabelText('Deshacer eliminación del producto'));
    expect(await screen.findByLabelText('Cantidad de Silla de ruedas, compra: 3')).toBeTruthy();
  });
  it('añade una renta desde el detalle mixto y actualiza su contador con el carrito compartido', async () => {
    await render(
      <CatalogPreviewProvider>
        <ConnectedCart detail />
      </CatalogPreviewProvider>,
    );
    await screen.findByLabelText('Ver carrito (3)');
    await fireEvent.press(screen.getByLabelText('Añadir renta al carrito'));
    expect(await screen.findByLabelText('Ver carrito (4)')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(
      'https://cemydi.test.invalid/cart/items',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ quantity: 1, productId: 101, mode: 'RENTA' }),
      }),
    );
  });
  it('aplica y retira un cupón real y muestra su rechazo', async () => {
    await show();
    await screen.findByText('Total: $1,000.00 MXN');
    expect(screen.getByText('¿Tienes un cupón?')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Aplicar cupón'));
    await fireEvent.changeText(screen.getByLabelText('Código de cupón'), 'INVALIDO');
    await fireEvent.press(screen.getAllByLabelText('Aplicar cupón').at(-1)!);
    expect(await screen.findByText('El código de cupón no existe')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Código de cupón'), 'AHORRO');
    await fireEvent.press(screen.getAllByLabelText('Aplicar cupón').at(-1)!);
    expect(await screen.findByText('Total: $923.00 MXN')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Quitar cupón'));
    expect(await screen.findByText('Total: $1,000.00 MXN')).toBeTruthy();
  });
  it('guarda fechas en la línea exacta aunque se repita el producto', async () => {
    installCartApiMock({
      ...CART_RESPONSE,
      items: [
        RENTAL_LINE,
        {
          ...RENTAL_LINE,
          id: 9,
          rentalStartDate: '2027-04-01T00:00:00.000Z',
          rentalEndDate: '2027-04-04T00:00:00.000Z',
          configurationStatus: 'COMPLETE',
        },
      ],
    });
    await show();
    await screen.findByText('Total: $1,000.00 MXN');
    await fireEvent.press(screen.getByLabelText('Configurar renta de Silla de ruedas'));
    await fireEvent.changeText(screen.getByLabelText('Fecha de inicio'), '01032027');
    await fireEvent.changeText(screen.getByLabelText('Fecha de devolución'), '10032027');
    await fireEvent.press(screen.getByLabelText('Guardar fechas'));
    await waitFor(() => expect(screen.queryByLabelText('Guardar fechas')).toBeNull());
    expect(fetch).toHaveBeenCalledWith(
      'https://cemydi.test.invalid/cart/items/8',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          quantity: 1,
          rentalStartDate: '2027-03-01',
          rentalEndDate: '2027-03-10',
          rentalNotes: '',
        }),
      }),
    );
    expect(screen.getByText('01/04/2027 al 04/04/2027')).toBeTruthy();
  });
  it('informa error inicial, permite reintentar y no muestra carrito vacío falso', async () => {
    const read = jest
      .spyOn(cartService, 'get')
      .mockRejectedValueOnce(new Error('Fallo de conexión'));
    await show();
    expect(await screen.findByText('No pudimos cargar la información')).toBeTruthy();
    expect(screen.queryByText('Tu carrito está vacío')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Reintentar'));
    expect(await screen.findByText('Total: $1,000.00 MXN')).toBeTruthy();
    expect(read).toHaveBeenCalledTimes(2);
  });
  it('muestra contenido disponible offline y bloquea escrituras', async () => {
    await show();
    await screen.findByText('Total: $1,000.00 MXN');
    await act(async () => {
      onlineManager.setOnline(false);
    });
    expect(screen.getByText(/Mostrando el último carrito/)).toBeTruthy();
    expect(screen.getByLabelText('Aumentar cantidad de Silla de ruedas, compra')).toBeDisabled();
    expect(screen.getByLabelText('Eliminar Silla de ruedas, compra')).toBeDisabled();
  });
  it('consulta cambios de la web al volver a la app aunque la caché siga fresca', async () => {
    const server = installCartApiMock();
    await show();
    await screen.findByLabelText('Cantidad de Silla de ruedas, compra: 2');
    await act(async () => {
      focusManager.setFocused(false);
      server.read().items[0].quantity = 4;
      focusManager.setFocused(true);
    });
    expect(await screen.findByLabelText('Cantidad de Silla de ruedas, compra: 4')).toBeTruthy();
  });
  it('actualiza cambios externos cada diez segundos y pausa las lecturas en segundo plano', async () => {
    jest.useFakeTimers();
    const server = installCartApiMock();
    const read = jest.spyOn(cartService, 'get');
    await show();
    await screen.findByLabelText('Cantidad de Silla de ruedas, compra: 2');
    server.read().items[0].quantity = 5;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(CART_SYNC_INTERVAL_MS);
    });
    expect(await screen.findByLabelText('Cantidad de Silla de ruedas, compra: 5')).toBeTruthy();
    await act(async () => {
      focusManager.setFocused(false);
    });
    const calls = read.mock.calls.length;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(CART_SYNC_INTERVAL_MS * 2);
    });
    expect(read).toHaveBeenCalledTimes(calls);
  });
  it('espera confirmación del servidor y bloquea envíos repetidos', async () => {
    let finish!: (cart: typeof CART_RESPONSE) => void;
    const operation = new Promise<typeof CART_RESPONSE>((resolve) => {
      finish = resolve;
    });
    jest.spyOn(cartService, 'update').mockReturnValueOnce(operation);
    await show();
    await screen.findByText('Total: $1,000.00 MXN');
    await fireEvent.press(screen.getByLabelText('Aumentar cantidad de Silla de ruedas, compra'));
    expect(screen.getByLabelText('Cantidad de Silla de ruedas, compra: 2')).toBeTruthy();
    expect(screen.getByLabelText('Aumentar cantidad de Silla de ruedas, compra')).toBeDisabled();
    await act(async () => {
      finish({ ...CART_RESPONSE, items: [{ ...CART_LINE, quantity: 3 }, RENTAL_LINE] });
    });
    expect(await screen.findByLabelText('Cantidad de Silla de ruedas, compra: 3')).toBeTruthy();
  });
  it('guarda productos de invitado sin perder el carrito que ya existe en la cuenta', async () => {
    await render(
      <CatalogPreviewProvider>
        <GuestProduct />
        <ConnectedCart />
      </CatalogPreviewProvider>,
    );
    await screen.findByText('Total: $1,000.00 MXN');
    await fireEvent.press(screen.getByLabelText('Guardar productos de invitado'));
    expect(await screen.findByLabelText('Cantidad de Silla de ruedas, compra: 3')).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByLabelText('Guardar productos de invitado')).toBeNull(),
    );
  });
  it('conserva las fechas y el error contractual al rechazar el servidor', async () => {
    jest
      .spyOn(cartService, 'update')
      .mockRejectedValueOnce(new UserFacingError('La renta mínima es de 3 días'));
    await show();
    await screen.findByText('Total: $1,000.00 MXN');
    await fireEvent.press(screen.getByLabelText('Configurar renta de Silla de ruedas'));
    await fireEvent.changeText(screen.getByLabelText('Fecha de inicio'), '01032027');
    await fireEvent.changeText(screen.getByLabelText('Fecha de devolución'), '02032027');
    await fireEvent.press(screen.getByLabelText('Guardar fechas'));
    expect(await screen.findByText('La renta mínima es de 3 días')).toBeTruthy();
    expect(screen.getByLabelText('Fecha de inicio')).toHaveProp('value', '01/03/2027');
    expect(screen.getByLabelText('Guardar fechas')).toBeTruthy();
  });
  it('obliga a comprobar el resultado después de perder una respuesta', async () => {
    jest
      .spyOn(cartService, 'update')
      .mockRejectedValueOnce(new ApiError('Sin respuesta', { kind: 'network' }));
    await show();
    await screen.findByText('Total: $1,000.00 MXN');
    await fireEvent.press(screen.getByLabelText('Aumentar cantidad de Silla de ruedas, compra'));
    expect(
      await screen.findByText(
        'No pudimos confirmar la actualización. Consulta el carrito antes de repetirla.',
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText('Aumentar cantidad de Silla de ruedas, compra')).toBeDisabled();
    await waitFor(() => expect(screen.getByLabelText('Actualizar carrito')).toBeEnabled());
    await fireEvent.press(screen.getByLabelText('Actualizar carrito'));
    await waitFor(() =>
      expect(screen.getByLabelText('Aumentar cantidad de Silla de ruedas, compra')).toBeEnabled(),
    );
    expect(screen.getByLabelText('Cantidad de Silla de ruedas, compra: 2')).toBeTruthy();
  });
  it('una respuesta tardía después de logout no repuebla el carrito privado', async () => {
    let finish!: (cart: typeof CART_RESPONSE) => void;
    jest.spyOn(cartService, 'update').mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await show();
    await screen.findByText('Total: $1,000.00 MXN');
    await fireEvent.press(screen.getByLabelText('Aumentar cantidad de Silla de ruedas, compra'));
    await act(async () => {
      await controls.logout();
    });
    await act(async () => {
      finish(CART_RESPONSE);
    });
    expect(await screen.findByText('Tu carrito está vacío')).toBeTruthy();
    expect(screen.queryByText('Total: $1,000.00 MXN')).toBeNull();
    expect(controls.client.getQueryData(['cart', 1])).toBeUndefined();
  });

  it('respeta el stock recibido y permite reducir una cantidad que ya lo supera', async () => {
    installCartApiMock({
      ...CART_RESPONSE,
      items: [
        {
          ...CART_LINE,
          quantity: 4,
          availability: {
            isAvailable: false,
            maxQuantity: 3,
            reason: 'La cantidad guardada supera el stock actual',
          },
        },
      ],
    });
    await show();
    await screen.findByLabelText('Cantidad de Silla de ruedas, compra: 4');
    expect(screen.getByText('La cantidad guardada supera el stock actual')).toBeTruthy();
    expect(screen.getByLabelText('Aumentar cantidad de Silla de ruedas, compra')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Reducir cantidad de Silla de ruedas, compra'));
    expect(await screen.findByLabelText('Cantidad de Silla de ruedas, compra: 3')).toBeTruthy();
  });

  it('no aplica un cupón con formato inválido ni expone errores internos', async () => {
    const apply = jest.spyOn(cartService, 'applyCoupon');
    await show();
    await screen.findByText('Total: $1,000.00 MXN');
    await fireEvent.press(screen.getByLabelText('Aplicar cupón'));
    await fireEvent.changeText(screen.getByLabelText('Código de cupón'), 'abc!');
    await fireEvent.press(screen.getAllByLabelText('Aplicar cupón').at(-1)!);
    expect(screen.getByText(/Usa entre 4 y 24/)).toBeTruthy();
    expect(apply).not.toHaveBeenCalled();
  });

  it('muestra el motivo de un cupón vencido sin inventar descuento', async () => {
    installCartApiMock({
      ...CART_RESPONSE,
      appliedCoupon: {
        id: 3,
        code: 'VENCIDO',
        description: 'Prueba',
        discountType: 'FIXED',
        discountValue: 100,
        minimumPurchase: 0,
        maximumDiscount: null,
        discountAmount: 0,
        isValid: false,
        reason: 'Este cupón ya venció',
      },
    });
    await show();
    expect(await screen.findByText('Este cupón ya venció')).toBeTruthy();
    expect(screen.getByText('Total: $1,000.00 MXN')).toBeTruthy();
  });

  it('distingue un carrito vacío confirmado de una lectura pendiente', async () => {
    installCartApiMock({
      ...CART_RESPONSE,
      items: [],
      summary: {
        ...CART_RESPONSE.summary,
        distinctItems: 0,
        totalQuantity: 0,
        total: 0,
      },
    });
    await show();
    expect(await screen.findByText('Tu carrito está vacío')).toBeTruthy();
    expect(screen.queryByText('Cargando carrito')).toBeNull();
  });

  it('expira la sesión si el carrito y la renovación devuelven 401', async () => {
    const original = jest.mocked(fetch).getMockImplementation()!;
    jest.mocked(fetch).mockImplementation((input, options) => {
      const path = new URL(String(input)).pathname;
      if (path === '/cart' || path === '/auth/mobile/refresh') {
        return Promise.resolve(
          new Response(JSON.stringify({ message: 'No autenticado' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return original(input, options);
    });
    await show();
    expect(await screen.findByText('Tu carrito está vacío')).toBeTruthy();
    expect(screen.queryByText('Total: $1,000.00 MXN')).toBeNull();
    expect(controls.client.getQueryData(['cart', 1])).toBeUndefined();
  });
});
