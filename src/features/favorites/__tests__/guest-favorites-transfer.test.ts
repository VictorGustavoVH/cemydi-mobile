import { transferGuestFavorites } from '../services/guest-favorites-transfer';
import { favoriteService } from '../services/favorite-service';
import { ApiError } from '@/services/http/api-error';

const confirmed = (productId: number) => ({ productId, favorited: true, message: 'Guardado' });
const options = () => ({ isCurrent: () => true, canContinue: () => true, onSaved: jest.fn() });

it('agrega sin toggle, deduplica y conserva ids de muestra sin enviarlos al servidor', async () => {
  const add = jest.spyOn(favoriteService, 'add').mockImplementation(async (id) => confirmed(id));
  const toggle = jest.spyOn(favoriteService, 'toggle');
  const controls = options();
  expect(await transferGuestFavorites(['1', '1', '2', 'wheelchair', '0'], controls)).toEqual({
    saved: 2,
    remaining: 2,
  });
  expect(add.mock.calls.map(([id]) => id)).toEqual([1, 2]);
  expect(controls.onSaved.mock.calls.map(([id]) => id)).toEqual(['1', '2']);
  expect(toggle).not.toHaveBeenCalled();
});

it.each([
  new ApiError('Sin red', { kind: 'network' }),
  new ApiError('Límite', { kind: 'http', status: 429 }),
])('conserva lo pendiente y detiene el lote al fallar: %s', async (error) => {
  const add = jest
    .spyOn(favoriteService, 'add')
    .mockResolvedValueOnce(confirmed(1))
    .mockRejectedValueOnce(error);
  const controls = options();
  expect(await transferGuestFavorites(['1', '2', '3'], controls)).toEqual({
    saved: 1,
    remaining: 2,
  });
  expect(add).toHaveBeenCalledTimes(2);
  expect(controls.onSaved.mock.calls).toEqual([['1']]);
});

it('conserva el producto retirado y continúa con los otros favoritos', async () => {
  jest
    .spyOn(favoriteService, 'add')
    .mockRejectedValueOnce(new ApiError('Retirado', { kind: 'http', status: 404 }))
    .mockResolvedValueOnce(confirmed(2));
  const controls = options();
  expect(await transferGuestFavorites(['1', '2'], controls)).toEqual({ saved: 1, remaining: 1 });
  expect(controls.onSaved.mock.calls).toEqual([['2']]);
});

it.each([{ ...confirmed(1), favorited: false }, confirmed(99)])(
  'no elimina un pendiente si la confirmación es inconsistente: %j',
  async (response) => {
    jest.spyOn(favoriteService, 'add').mockResolvedValueOnce(response);
    const controls = options();
    expect(await transferGuestFavorites(['1'], controls)).toEqual({ saved: 0, remaining: 1 });
    expect(controls.onSaved).not.toHaveBeenCalled();
  },
);

it('descarta una respuesta tardía después de cambiar la sesión y no envía el siguiente id', async () => {
  let current = true;
  let finish!: (value: ReturnType<typeof confirmed>) => void;
  const add = jest.spyOn(favoriteService, 'add').mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const controls = { ...options(), isCurrent: () => current };
  const pending = transferGuestFavorites(['1', '2'], controls);
  expect(add).toHaveBeenCalledTimes(1);
  current = false;
  finish(confirmed(1));
  await expect(pending).rejects.toMatchObject({ kind: 'abort' });
  expect(controls.onSaved).not.toHaveBeenCalled();
  expect(add).toHaveBeenCalledTimes(1);
});

it('pausa sin enviar peticiones si se pierde foco o conectividad', async () => {
  const add = jest.spyOn(favoriteService, 'add');
  expect(await transferGuestFavorites(['1'], { ...options(), canContinue: () => false })).toEqual({
    saved: 0,
    remaining: 1,
  });
  expect(add).not.toHaveBeenCalled();
});
