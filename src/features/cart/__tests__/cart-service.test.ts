import { configureHttpAuth } from '@/services/http/client';
import { cartSchema, cartService } from '../services/cart-service';
import {
  CART_RESPONSE,
  CART_LINE,
  RENTAL_LINE,
  installCartApiMock,
} from '../../../../tests/support/cart-api-mock';
import { jsonResponse } from '../../../../tests/support/auth-api-mock';
import { toCartEntry } from '../services/cart-adapter';
import { createCartTransfer } from '../services/cart-transfer';

describe('Contrato del carrito y transferencia', () => {
  beforeEach(() =>
    configureHttpAuth({
      getAccessToken: () => 'fixture',
      getVersion: () => 1,
      refresh: async () => undefined,
      expired: async () => undefined,
    }),
  );
  it('valida carrito, cupón y documentos con ids contractuales, sin inventar defaults', () => {
    expect(cartSchema.safeParse(CART_RESPONSE).success).toBe(true);
    expect(cartSchema.safeParse({ ...CART_RESPONSE, id: 3 }).success).toBe(false);
    expect(cartSchema.safeParse({ ...CART_RESPONSE, summary: { total: 123 } }).success).toBe(false);
    expect(
      cartSchema.safeParse({
        ...CART_RESPONSE,
        items: [
          {
            ...RENTAL_LINE,
            document: {
              id: 'c343af9c-f65a-4eb9-83df-ef77e3b53548',
              originalFilename: 'receta.pdf',
              mimeType: 'application/pdf',
              bytes: 100,
              status: 'PENDIENTE',
              uploadedAt: CART_LINE.createdAt,
              associatedAt: null,
            },
          },
        ],
      }).success,
    ).toBe(true);
  });
  it('usa Bearer y los DTOs de agregar, actualizar, quitar, vaciar y cupones', async () => {
    installCartApiMock();
    await cartService.get();
    await cartService.add({ productId: 101, mode: 'VENTA', quantity: 1 });
    await cartService.update(8, {
      quantity: 1,
      rentalStartDate: '2027-03-01',
      rentalEndDate: '2027-03-10',
      rentalNotes: 'Mañana',
    });
    await cartService.applyCoupon('AHORRO');
    await cartService.removeCoupon();
    await cartService.remove(7);
    await cartService.clearRentals();
    await cartService.clear();
    const requests = jest.mocked(fetch).mock.calls;
    expect(new Headers(requests[0][1]?.headers).get('Authorization')).toBe('Bearer fixture');
    expect(requests[1][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ quantity: 1, productId: 101, mode: 'VENTA' }),
      credentials: 'omit',
    });
    expect(requests[2][0]).toContain('/cart/items/8');
    expect(requests[7][0]).toBe('https://cemydi.test.invalid/cart');
  });
  it('propaga reglas del servidor, conectividad y contrato inválido sin falsear éxito', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'Stock insuficiente' }, 400));
    await expect(cartService.add({ productId: 101, mode: 'VENTA', quantity: 1 })).rejects.toThrow(
      'Stock insuficiente',
    );
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'SQL SELECT secret' }, 400));
    await expect(cartService.add({ productId: 101, mode: 'VENTA', quantity: 1 })).rejects.toThrow(
      'No pudimos modificar el carrito',
    );
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ cart: {} }));
    await expect(cartService.get()).rejects.toMatchObject({ kind: 'parse' });
    await expect(cartService.get()).rejects.toMatchObject({ kind: 'network' });
  });
  it('conserva ids separados para dos rentas del mismo producto', () => {
    const first = toCartEntry(RENTAL_LINE);
    const second = toCartEntry({ ...RENTAL_LINE, id: 9 });
    expect(first.item.productId).toBe(second.item.productId);
    expect(first.item.serverId).not.toBe(second.item.serverId);
    expect(toCartEntry(RENTAL_LINE)).toBe(first);
  });
  it('reconcilia un POST confirmado cuya respuesta se perdió, sin sumar dos veces', async () => {
    const server = installCartApiMock({ ...CART_RESPONSE, items: [] });
    const previous = jest.mocked(fetch).getMockImplementation()!;
    let lost = false;
    jest.mocked(fetch).mockImplementation(async (url, options) => {
      const result = await previous(url, options);
      if (String(url).endsWith('/cart/items') && !lost) {
        lost = true;
        throw new Error('Respuesta perdida');
      }
      return result;
    });
    const transfer = createCartTransfer();
    const guest = [{ productId: '101', mode: 'purchase' as const, quantity: 2, selected: true }];
    const saved = jest.fn();
    await expect(transfer.save(guest, () => true, saved)).rejects.toMatchObject({
      kind: 'network',
    });
    expect(saved).not.toHaveBeenCalled();
    await transfer.save(guest, () => true, saved);
    expect(server.read().items[0].quantity).toBe(2);
    expect(saved).toHaveBeenCalledTimes(1);
    expect(
      jest.mocked(fetch).mock.calls.filter(([, options]) => options?.method === 'POST'),
    ).toHaveLength(1);
  });
  it('no sobreescribe cambios ajenos ni retira productos de invitado si falla el guardado', async () => {
    const server = installCartApiMock({ ...CART_RESPONSE, items: [{ ...CART_LINE, quantity: 2 }] });
    const transfer = createCartTransfer();
    const saved = jest.fn();
    const guest = [{ productId: '101', mode: 'purchase' as const, quantity: 1, selected: true }];
    const update = jest
      .spyOn(cartService, 'update')
      .mockRejectedValueOnce(new Error('Sin respuesta'));
    await expect(transfer.save(guest, () => true, saved)).rejects.toThrow();
    server.read().items[0].quantity = 5;
    await expect(transfer.save(guest, () => true, saved)).rejects.toThrow('El carrito cambió');
    expect(update).toHaveBeenCalledTimes(1);
    expect(saved).not.toHaveBeenCalled();
  });
  it('rechaza transferir después de cambiar de sesión', async () => {
    installCartApiMock();
    const saved = jest.fn();
    await expect(
      createCartTransfer().save(
        [{ productId: '101', mode: 'purchase', quantity: 1, selected: true }],
        () => false,
        saved,
      ),
    ).rejects.toThrow('sesión cambió');
    expect(saved).not.toHaveBeenCalled();
  });

  it('transfiere una renta conservando fechas y notas sin alterar otro periodo del mismo producto', async () => {
    const server = installCartApiMock({
      ...CART_RESPONSE,
      items: [
        {
          ...RENTAL_LINE,
          rentalStartDate: '2027-04-01T00:00:00.000Z',
          rentalEndDate: '2027-04-04T00:00:00.000Z',
          configurationStatus: 'COMPLETE',
        },
      ],
    });
    const saved = jest.fn();
    await createCartTransfer().save(
      [
        {
          productId: '101',
          mode: 'rental',
          quantity: 2,
          selected: true,
          rentalDraft: {
            startDate: '2027-05-01',
            endDate: '2027-05-07',
            notes: 'Entrega matutina',
          },
        },
      ],
      () => true,
      saved,
    );
    expect(server.read().items).toHaveLength(2);
    expect(server.read().items[0].quantity).toBe(1);
    expect(server.read().items[1]).toMatchObject({
      quantity: 2,
      mode: 'RENTA',
      rentalStartDate: '2027-05-01T00:00:00.000Z',
      rentalEndDate: '2027-05-07T00:00:00.000Z',
      rentalNotes: 'Entrega matutina',
    });
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('no envía cantidades inválidas, ids no positivos ni cupones fuera del DTO', async () => {
    const count = jest.mocked(fetch).mock.calls.length;
    expect(() => cartService.add({ productId: 101, mode: 'VENTA', quantity: 26 })).toThrow();
    expect(() => cartService.update(0, { quantity: 1 })).toThrow();
    expect(() => cartService.applyCoupon('abc!')).toThrow();
    expect(jest.mocked(fetch).mock.calls).toHaveLength(count);
  });

  it('no pierde pendientes si la suma excede el límite ni envía productos de muestra', async () => {
    installCartApiMock({ ...CART_RESPONSE, items: [{ ...CART_LINE, quantity: 25 }] });
    const saved = jest.fn();
    const transfer = createCartTransfer();
    await expect(
      transfer.save(
        [{ productId: '101', mode: 'purchase', quantity: 1, selected: true }],
        () => true,
        saved,
      ),
    ).rejects.toThrow('La suma supera 25');
    await expect(
      transfer.save(
        [{ productId: 'wheelchair', mode: 'purchase', quantity: 1, selected: true }],
        () => true,
        saved,
      ),
    ).rejects.toThrow('productos de muestra');
    expect(saved).not.toHaveBeenCalled();
    expect(jest.mocked(fetch).mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(
      true,
    );
  });

  it('solo retira líneas ya guardadas cuando falla una transferencia parcial', async () => {
    installCartApiMock({ ...CART_RESPONSE, items: [] });
    jest
      .spyOn(cartService, 'add')
      .mockImplementationOnce(async (input) => ({
        ...CART_RESPONSE,
        items: [{ ...CART_LINE, quantity: input.quantity }],
      }))
      .mockRejectedValueOnce(new Error('Sin conexión'));
    const first = { productId: '101', mode: 'purchase' as const, quantity: 1, selected: true };
    const second = { ...first, productId: '102' };
    const saved = jest.fn();
    await expect(createCartTransfer().save([first, second], () => true, saved)).rejects.toThrow(
      'Sin conexión',
    );
    expect(saved).toHaveBeenCalledTimes(1);
    expect(saved).toHaveBeenCalledWith(first);
  });
});
