import { configureHttpAuth } from '@/services/http/client';
import { ApiError } from '@/services/http/api-error';
import { jsonResponse } from '../../../../tests/support/auth-api-mock';
import { favoriteService } from '../services/favorite-service';

const mockProduct = {
  id: 1,
  slug: 'silla-de-ruedas-estandar',
  nombre: 'Silla de Ruedas Estándar',
  marca: 'CEMYDI Care',
  modelo: 'SR-100',
  descripcion: 'Silla de ruedas ligera y plegable.',
  clasificacion: 'Movilidad',
  precio: 2500,
  stock: 10,
  activo: true,
  tipoAdquisicion: 'VENTA' as const,
  requiereReceta: false,
  rentalDailyPrice: null,
  rentalMinDays: 1,
  rentalDeposit: 0,
  rentalTerms: null,
  medidas: null,
  pesoSoportado: null,
  material: null,
  contenidoCaja: null,
  indicacionesUso: null,
  imageUrl: 'https://images.test/silla.png',
  images: [
    {
      id: 101,
      imageUrl: 'https://images.test/silla.png',
      sortOrder: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('favoriteService', () => {
  beforeEach(() => {
    configureHttpAuth({
      getAccessToken: () => 'valid-bearer-token',
      getVersion: () => 1,
      refresh: async () => undefined,
      expired: async () => undefined,
    });
  });

  it('valida el esquema de lista de favoritos devuelto por el servidor', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        products: [mockProduct],
        favoriteIds: [1],
        total: 1,
      }),
    );

    const result = await favoriteService.listMine();
    expect(result.total).toBe(1);
    expect(result.products[0].nombre).toBe('Silla de Ruedas Estándar');
    expect(result.favoriteIds).toEqual([1]);
  });

  it('falla con ApiError si el payload de lista de favoritos es inválido', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        products: [{ id: 'not-a-number' }],
      }),
    );

    await expect(favoriteService.listMine()).rejects.toThrow(ApiError);
  });

  it('obtiene los IDs de favoritos correctamente', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        favoriteIds: [1, 2, 3],
      }),
    );

    const result = await favoriteService.listMyIds();
    expect(result.favoriteIds).toEqual([1, 2, 3]);
  });

  it('alterna el estado de un favorito (toggle)', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        message: 'Producto guardado en favoritos',
        favorited: true,
        productId: 1,
      }),
    );

    const result = await favoriteService.toggle(1);
    expect(result.favorited).toBe(true);
    expect(result.productId).toBe(1);
  });

  it('elimina un favorito', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        message: 'Producto eliminado de favoritos',
        favorited: false,
        productId: 1,
      }),
    );

    const result = await favoriteService.remove(1);
    expect(result.favorited).toBe(false);
    expect(result.productId).toBe(1);
  });
});
