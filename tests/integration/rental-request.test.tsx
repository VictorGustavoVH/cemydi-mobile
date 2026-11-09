import { useEffect } from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';
import { getDocumentAsync } from 'expo-document-picker';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { RentalRequestScreen } from '@/features/cart/RentalRequestScreen';
import { useAuth } from '@/providers/auth-provider';
import { render } from '../support/render-with-toast';
import { CatalogPreviewProvider } from '../support/catalog-cart-provider';
import { AUTH_ACCOUNT, installAuthApiMock, jsonResponse } from '../support/auth-api-mock';
import { CART_RESPONSE, RENTAL_LINE, installCartApiMock } from '../support/cart-api-mock';
import { RENTAL } from '../support/account-api-mock';
import { installNetworkMock } from '../support/network-mock';
import { ApiError } from '@/services/http/api-error';
import { cartService } from '@/features/cart/services/cart-service';
import { rentalRequestService } from '@/services/rentals/rental-request';
import type { ServerCart } from '@/features/cart/services/cart-service';
import { colors } from '@/theme';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));
const mockDeleteFile = jest.fn();
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  Directory: jest.fn(() => ({ uri: 'file:///cache/DocumentPicker/', exists: false })),
  FileMode: { ReadOnly: 0 },
  File: jest.fn().mockImplementation(() => ({
    exists: true,
    size: 100,
    delete: mockDeleteFile,
    open: () => ({
      readBytes: () => new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]),
      close: jest.fn(),
    }),
  })),
}));
let auth: ReturnType<typeof useAuth>;
function Connected() {
  const current = useAuth();
  useEffect(() => {
    auth = current;
  }, [current]);
  useEffect(() => {
    void current.service.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, false);
  }, [current.service]);
  return <RentalRequestScreen />;
}
const initial = {
  ...CART_RESPONSE,
  items: [
    CART_RESPONSE.items[0],
    {
      ...RENTAL_LINE,
      configurationStatus: 'COMPLETE' as const,
      rentalStartDate: '2027-03-01T00:00:00.000Z',
      rentalEndDate: '2027-03-04T00:00:00.000Z',
      rentalDays: 4,
      rentalSummary: { ...RENTAL_LINE.rentalSummary!, subtotal: 160, total: 660 },
      product: { ...RENTAL_LINE.product, requiereReceta: true },
    },
  ],
  summary: {
    ...CART_RESPONSE.summary,
    rentalSubtotal: 160,
    rentalDepositTotal: 500,
    hasUnconfiguredRentalItems: false,
  },
};
const document = {
  id: 'c343af9c-f65a-4eb9-83df-ef77e3b53548',
  originalFilename: 'receta.pdf',
  mimeType: 'application/pdf',
  bytes: 100,
  status: 'PENDIENTE' as const,
  uploadedAt: RENTAL.createdAt,
  associatedAt: null,
};
async function show(withDocument = false, initialCart: ServerCart = initial) {
  const api = installCartApiMock(
    withDocument
      ? {
          ...initialCart,
          items: initialCart.items.map((item) =>
            item.mode === 'RENTA' ? { ...item, document } : item,
          ),
        }
      : initialCart,
  );
  const previous = jest.mocked(fetch).getMockImplementation()!;
  jest.mocked(fetch).mockImplementation(async (input, options) => {
    const path = new URL(String(input)).pathname;
    if (path === '/rentals/cart-items/8/prescription') {
      api.read().items[1].document = options?.method === 'DELETE' ? null : document;
      return jsonResponse({ message: 'Adjunta', document });
    }
    if (path === '/rentals/from-cart') {
      api.read().items = api.read().items.filter((item) => item.mode !== 'RENTA');
      return jsonResponse({ message: 'CEMYDI revisará tu solicitud.', rental: RENTAL });
    }
    return previous(input, options);
  });
  await render(
    <CatalogPreviewProvider>
      <Connected />
    </CatalogPreviewProvider>,
  );
  await screen.findByText('Completa tu solicitud');
  return api;
}
async function review() {
  await fireEvent.changeText(screen.getByLabelText('Teléfono de contacto'), '5551234567');
  await fireEvent.press(screen.getByLabelText('Revisar solicitud'));
  await screen.findByText('Todo listo para revisar');
}
async function accept() {
  await fireEvent.press(screen.getByLabelText('Acepto las condiciones de renta'));
  await fireEvent.press(screen.getByLabelText('Acepto el tratamiento de datos y documentos'));
}
describe('Flujo de solicitud de renta', () => {
  beforeEach(() => {
    onlineManager.setOnline(true);
    installNetworkMock();
    installAuthApiMock();
  });
  afterEach(() => onlineManager.setOnline(true));
  it('formatea el teléfono, limita diez dígitos y conserva la hora elegida entre pasos', async () => {
    await show(true);
    const phone = screen.getByLabelText('Teléfono de contacto');
    expect(phone).toHaveProp('keyboardType', 'phone-pad');
    await fireEvent.changeText(phone, '789a123b456789');
    expect(screen.getByDisplayValue('789 123 4567')).toBeTruthy();
    await fireEvent.changeText(phone, '789123456');
    await fireEvent.press(screen.getByLabelText('Revisar solicitud'));
    expect(await screen.findByText('Escribe un teléfono de 10 dígitos.')).toBeTruthy();
    await fireEvent.changeText(phone, '7891234567');
    await fireEvent.press(screen.getByLabelText('Horario de recogida (opcional)'));
    await fireEvent(
      screen.getByTestId('Horario Horario de recogida (opcional)'),
      'onChange',
      { type: 'set' },
      new Date(2027, 0, 1, 13, 5),
    );
    if (screen.queryByLabelText('Confirmar hora'))
      await fireEvent.press(screen.getByLabelText('Confirmar hora'));
    await fireEvent.press(screen.getByLabelText('Revisar solicitud'));
    await screen.findByText('Todo listo para revisar');
    await fireEvent.press(screen.getByLabelText('Editar datos'));
    expect(
      screen.getByLabelText('Horario de recogida (opcional)').props.accessibilityValue.text,
    ).toMatch(/1:05/);
    expect(screen.getByDisplayValue('789 123 4567')).toBeTruthy();
  });

  it('muestra la imagen mientras sube, bloquea cierre y guardado, y limpia la copia al cerrar', async () => {
    const api = await show();
    await review();
    await fireEvent.press(screen.getByLabelText('Configurar renta de Silla de ruedas'));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('expo-file-system') as typeof import('expo-file-system');
    jest.mocked(fs.File).mockImplementationOnce(
      () =>
        ({
          exists: true,
          size: 100,
          delete: mockDeleteFile,
          open: () => ({
            readBytes: () => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
            close: jest.fn(),
          }),
        }) as unknown as InstanceType<typeof fs.File>,
    );
    jest.mocked(getDocumentAsync).mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///cache/DocumentPicker/receta.png',
          name: 'receta.png',
          mimeType: 'image/png',
          size: 100,
          lastModified: 0,
        },
      ],
    });
    let finish!: (result: Awaited<ReturnType<typeof rentalRequestService.upload>>) => void;
    jest.spyOn(rentalRequestService, 'upload').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await fireEvent.press(screen.getByLabelText('Adjuntar receta de Silla de ruedas'));
    expect(await screen.findByLabelText('Vista previa de receta.png')).toHaveProp(
      'cachePolicy',
      'none',
    );
    expect(screen.getByRole('progressbar', { name: 'Subiendo receta' })).toBeTruthy();
    expect(screen.getByLabelText('Cerrar')).toBeDisabled();
    expect(screen.getByLabelText('Guardar configuración')).toBeDisabled();
    expect(mockDeleteFile).not.toHaveBeenCalled();
    const uploaded = { ...document, originalFilename: 'receta.png', mimeType: 'image/png' };
    api.read().items[1].document = uploaded;
    await act(async () => finish({ message: 'Adjunta', document: uploaded }));
    await waitFor(() =>
      expect(screen.queryByRole('progressbar', { name: 'Subiendo receta' })).toBeNull(),
    );
    expect(screen.getByLabelText('Vista previa de receta.png')).toBeTruthy();
    expect(mockDeleteFile).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Cerrar'));
    expect(mockDeleteFile).toHaveBeenCalledTimes(1);
  });
  it('limpia la vista previa tras cerrar sesión durante una subida sin mostrar éxito tardío', async () => {
    await show();
    await review();
    await fireEvent.press(screen.getByLabelText('Configurar renta de Silla de ruedas'));
    jest.mocked(getDocumentAsync).mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///cache/DocumentPicker/fixture.pdf',
          name: 'receta.pdf',
          mimeType: 'application/pdf',
          size: 100,
          lastModified: 0,
        },
      ],
    });
    let finish!: (result: Awaited<ReturnType<typeof rentalRequestService.upload>>) => void;
    jest.spyOn(rentalRequestService, 'upload').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await fireEvent.press(screen.getByLabelText('Adjuntar receta de Silla de ruedas'));
    await screen.findByRole('progressbar', { name: 'Subiendo receta' });
    await act(async () => {
      await auth.logout();
    });
    expect(await screen.findByText('Inicia sesión para solicitar una renta')).toBeTruthy();
    expect(mockDeleteFile).not.toHaveBeenCalled();
    await act(async () => finish({ message: 'Adjunta', document }));
    await waitFor(() => expect(mockDeleteFile).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Receta adjuntada')).toBeNull();
  });

  it('reutiliza configurar renta y adjunta la receta únicamente dentro del menú', async () => {
    await show();
    expect(screen.queryByText('Por ahora no contamos con entrega a domicilio.')).toBeNull();
    await review();
    expect(screen.getByText('Pendiente de completar')).toBeTruthy();
    expect(screen.getByText('Terminar de configurar')).toBeTruthy();
    expect(screen.queryByText('Editar fechas de Silla de ruedas')).toBeNull();
    expect(screen.queryByLabelText('Adjuntar receta de Silla de ruedas')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Configurar renta de Silla de ruedas'));
    expect(screen.getByText('Configurar renta')).toBeTruthy();
    expect(
      screen.getAllByLabelText('Adjuntar receta de Silla de ruedas', {
        includeHiddenElements: true,
      }),
    ).toHaveLength(1);
    await fireEvent.press(screen.getByLabelText('Guardar configuración'));
    expect(
      await screen.findByText('Debes adjuntar el archivo para guardar la configuración.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Cerrar'));
    expect(screen.queryByLabelText('Adjuntar receta de Silla de ruedas')).toBeNull();
    expect(screen.getByText('Pendiente de completar')).toBeTruthy();
    expect(screen.getByLabelText('Enviar solicitud de renta')).toBeDisabled();
  });
  it('conserva los datos entre pasos y ofrece únicamente recogida en sucursal', async () => {
    await show(true);
    expect(screen.getByRole('progressbar', { name: 'Progreso del formulario' })).toHaveProp(
      'accessibilityValue',
      { min: 1, max: 2, now: 1 },
    );
    expect(screen.getByText('Recoger en sucursal')).toBeTruthy();
    expect(screen.queryByLabelText('Entrega a domicilio')).toBeNull();
    await fireEvent.changeText(
      screen.getByLabelText('Notas generales (opcional)'),
      'Recoger por la mañana',
    );
    await review();
    expect(screen.getByRole('progressbar', { name: 'Progreso del formulario' })).toHaveProp(
      'accessibilityValue',
      { min: 1, max: 2, now: 2 },
    );
    await fireEvent.press(screen.getByLabelText('Editar datos'));
    expect(screen.getByDisplayValue('555 123 4567')).toBeTruthy();
    expect(screen.getByDisplayValue('Recoger por la mañana')).toBeTruthy();
  });
  it('leer las condiciones no acepta el checklist y cada consentimiento sigue siendo obligatorio', async () => {
    await show(true);
    await review();
    await fireEvent.press(screen.getByLabelText('Leer condiciones de renta'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/perfil/legal/[slug]',
      params: { slug: 'terminos-y-condiciones' },
    });
    expect(
      screen.getByRole('checkbox', { name: 'Acepto las condiciones de renta', checked: false }),
    ).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Acepto el tratamiento de datos y documentos'));
    expect(screen.getByLabelText('Enviar solicitud de renta')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Acepto las condiciones de renta'));
    expect(screen.getByLabelText('Enviar solicitud de renta')).toBeEnabled();
    await fireEvent.press(screen.getByLabelText('Acepto las condiciones de renta'));
    expect(screen.getByLabelText('Enviar solicitud de renta')).toBeDisabled();
  });
  it('colorea solo los datos correctos y reconoce texto opcional completado', async () => {
    await show();
    await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'correo incompleto');
    expect(screen.getByLabelText('Correo electrónico')).not.toHaveStyle({
      borderColor: colors.brand,
    });
    await fireEvent.changeText(
      screen.getByLabelText('Correo electrónico'),
      'cliente@example.invalid',
    );
    expect(screen.getByLabelText('Correo electrónico')).toHaveStyle({ borderColor: colors.brand });
    await fireEvent.changeText(screen.getByLabelText('Teléfono de contacto'), '123');
    expect(screen.getByLabelText('Teléfono de contacto')).not.toHaveStyle({
      borderColor: colors.brand,
    });
    await fireEvent.changeText(screen.getByLabelText('Teléfono de contacto'), '5551234567');
    expect(screen.getByLabelText('Teléfono de contacto')).toHaveStyle({
      borderColor: colors.brand,
    });
    await fireEvent.changeText(
      screen.getByLabelText('Notas generales (opcional)'),
      'Entrega por la tarde',
    );
    expect(screen.getByLabelText('Notas generales (opcional)')).toHaveStyle({
      borderColor: colors.brand,
      height: 120,
    });
  });
  it('invalida fechas pasadas del carrito y bloquea el envío aunque estén completas y tengan receta', async () => {
    await show(true, {
      ...initial,
      items: initial.items.map((item) =>
        item.mode === 'RENTA'
          ? {
              ...item,
              rentalStartDate: '2020-01-01T00:00:00.000Z',
              rentalEndDate: '2020-01-04T00:00:00.000Z',
            }
          : item,
      ),
    });
    await review();
    await accept();
    expect(screen.getByText(/corrige la fecha de inicio/)).toBeTruthy();
    expect(screen.getByLabelText('Enviar solicitud de renta')).toBeDisabled();
    expect(
      jest.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/rentals/from-cart')),
    ).toBe(false);
  });
  it('valida datos condicionales antes de pasar a revisión', async () => {
    await show();
    expect(screen.queryByLabelText('Entrega a domicilio')).toBeNull();
    expect(screen.queryByLabelText('Calle y número')).toBeNull();
    await fireEvent.press(screen.getByLabelText('El equipo es para otra persona'));
    await fireEvent.press(screen.getByLabelText('Revisar solicitud'));
    expect(await screen.findByText('Escribe el nombre del paciente.')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/rentals/from-cart'),
      expect.anything(),
    );
    await fireEvent.press(screen.getByLabelText('Otro'));
    expect(screen.getByLabelText('Especifica la relación')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Madre o padre'));
    expect(screen.queryByLabelText('Especifica la relación')).toBeNull();
  });
  it('limpia la copia local si falla la subida sin fingir que existe una receta', async () => {
    await show();
    await review();
    await fireEvent.press(screen.getByLabelText('Configurar renta de Silla de ruedas'));
    jest.mocked(getDocumentAsync).mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///cache/DocumentPicker/fixture.pdf',
          name: 'receta.pdf',
          size: 100,
          mimeType: 'application/pdf',
          lastModified: 0,
        },
      ],
    });
    jest
      .spyOn(rentalRequestService, 'upload')
      .mockRejectedValueOnce(new ApiError('offline', { kind: 'network' }));
    await fireEvent.press(screen.getByLabelText('Adjuntar receta de Silla de ruedas'));
    await waitFor(() =>
      expect(
        within(screen.getByTestId('toast-viewport')).getByText(/No fue posible conectar/),
      ).toBeTruthy(),
    );
    expect(mockDeleteFile).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Quitar receta de Silla de ruedas')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Cerrar'));
    expect(screen.getByLabelText('Enviar solicitud de renta')).toBeDisabled();
  });
  it('adjunta y quita recetas, bloquea envío incompleto y conserva compras tras enviar', async () => {
    const api = await show();
    await review();
    await accept();
    expect(screen.getByLabelText('Enviar solicitud de renta')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Configurar renta de Silla de ruedas'));
    jest.mocked(getDocumentAsync).mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///cache/DocumentPicker/fixture.pdf',
          name: 'receta.pdf',
          mimeType: 'application/pdf',
          size: 100,
          lastModified: 0,
        },
      ],
    });
    await fireEvent.press(screen.getByLabelText('Adjuntar receta de Silla de ruedas'));
    await screen.findByText('receta.pdf');
    await fireEvent.press(screen.getByLabelText('Quitar receta de Silla de ruedas'));
    await screen.findByLabelText('Adjuntar receta de Silla de ruedas');
    expect(mockDeleteFile).toHaveBeenCalledTimes(1);
    jest.mocked(getDocumentAsync).mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///cache/DocumentPicker/fixture.pdf',
          name: 'receta.pdf',
          mimeType: 'application/pdf',
          size: 100,
          lastModified: 0,
        },
      ],
    });
    await fireEvent.press(screen.getByLabelText('Adjuntar receta de Silla de ruedas'));
    await screen.findByLabelText('Abrir PDF con otra aplicación');
    expect(screen.getByText(/la aplicación que elijas tendrá acceso a tu receta/)).toBeTruthy();
    expect(shareAsync).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByLabelText('Abrir PDF con otra aplicación')).toBeEnabled(),
    );
    await fireEvent.press(screen.getByLabelText('Abrir PDF con otra aplicación'));
    await waitFor(() => expect(isAvailableAsync).toHaveBeenCalled());
    await waitFor(() =>
      expect(shareAsync).toHaveBeenCalledWith(
        'file:///cache/DocumentPicker/fixture.pdf',
        expect.objectContaining({ mimeType: 'application/pdf' }),
      ),
    );
    await waitFor(() => expect(screen.getByLabelText('Guardar configuración')).toBeEnabled());
    await fireEvent.press(screen.getByLabelText('Guardar configuración'));
    await waitFor(() => expect(screen.queryByLabelText('Guardar configuración')).toBeNull());
    await waitFor(() => expect(screen.getByLabelText('Enviar solicitud de renta')).toBeEnabled());
    expect(screen.queryByText('Pendiente de completar')).toBeNull();
    expect(mockDeleteFile).toHaveBeenCalledTimes(2);
    await fireEvent.press(screen.getByLabelText('Enviar solicitud de renta'));
    expect(await screen.findByText('Recibimos tu solicitud')).toBeTruthy();
    expect(screen.getByTestId('rental-success-checkmark')).toBeTruthy();
    expect(screen.getByText('REN-123')).toBeTruthy();
    expect(screen.getByText('Pendiente')).toBeTruthy();
    expect(screen.getByLabelText('Total solicitado: $500.00 MXN')).toBeTruthy();
    expect(api.read().items.map((item) => item.mode)).toEqual(['VENTA']);
    const submission = jest
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url).endsWith('/rentals/from-cart'));
    expect(JSON.parse(String(submission?.[1]?.body))).toMatchObject({ deliveryMethod: 'PICKUP' });
    await fireEvent.press(screen.getByLabelText('Ver mi solicitud'));
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/perfil/renta/[id]',
      params: { id: RENTAL.id },
    });
  });
  it('conserva la confirmación si falla la recarga posterior del carrito', async () => {
    await show(true);
    await review();
    await accept();
    jest
      .spyOn(cartService, 'get')
      .mockRejectedValueOnce(new ApiError('offline', { kind: 'network' }));
    await fireEvent.press(screen.getByLabelText('Enviar solicitud de renta'));
    expect(await screen.findByText('Recibimos tu solicitud')).toBeTruthy();
    expect(
      jest.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/rentals/from-cart')),
    ).toHaveLength(1);
  });
  it('bloquea el envío offline y descarta datos del formulario al cerrar sesión', async () => {
    await show(true);
    await review();
    await accept();
    await act(async () => onlineManager.setOnline(false));
    expect(screen.getByLabelText('Enviar solicitud de renta')).toBeDisabled();
    await act(async () => {
      onlineManager.setOnline(true);
      await auth.logout();
    });
    expect(await screen.findByText('Inicia sesión para solicitar una renta')).toBeTruthy();
    expect(screen.queryByText('Todo listo para revisar')).toBeNull();
  });
});
