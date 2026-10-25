import { QueryClient } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react-native';
import { productFixture } from '../../../../tests/support/product-fixtures';
import { productService } from '../product-service';
import { productDetailKey, prefetchProductDetail, seedProductDetail } from '../product-cache';

const clients: QueryClient[] = [];

function createClient() {
  const client = new QueryClient();
  clients.push(client);
  return client;
}

afterEach(() => {
  for (const client of clients) client.clear();
  clients.length = 0;
});

describe('Caché compartida del detalle', () => {
  it('deja el producto completo bajo la clave del detalle', () => {
    const client = createClient();
    seedProductDetail(client, productFixture(7));
    expect(client.getQueryData(productDetailKey('7'))).toEqual({ product: productFixture(7) });
  });

  it('conserva la frescura del origen para no reconsultar sin motivo', () => {
    const client = createClient();
    seedProductDetail(client, productFixture(7), 1_000);
    expect(client.getQueryState(productDetailKey(7))?.dataUpdatedAt).toBe(1_000);
  });

  it('no retrocede a un origen más antiguo que el dato guardado', () => {
    const client = createClient();
    seedProductDetail(client, productFixture(7, { nombre: 'Consultado' }), 2_000);
    seedProductDetail(client, productFixture(7, { nombre: 'Del listado' }), 1_000);
    expect(client.getQueryData(productDetailKey(7))).toEqual({
      product: productFixture(7, { nombre: 'Consultado' }),
    });
  });

  it('actualiza cuando el origen es posterior', () => {
    const client = createClient();
    seedProductDetail(client, productFixture(7, { nombre: 'Del listado' }), 1_000);
    seedProductDetail(client, productFixture(7, { nombre: 'Consultado' }), 2_000);
    expect(client.getQueryData(productDetailKey(7))).toEqual({
      product: productFixture(7, { nombre: 'Consultado' }),
    });
  });

  it('precarga el detalle cuando la pantalla solo conoce el id', async () => {
    const detail = jest
      .spyOn(productService, 'detail')
      .mockResolvedValue({ product: productFixture(7) });
    const client = createClient();

    prefetchProductDetail(client, 7);

    await waitFor(() =>
      expect(client.getQueryData(productDetailKey(7))).toEqual({ product: productFixture(7) }),
    );
    expect(detail).toHaveBeenCalledWith('7', expect.any(AbortSignal));
  });

  it('no vuelve a pedir el detalle si ya hay datos en caché', () => {
    const detail = jest.spyOn(productService, 'detail');
    const client = createClient();
    seedProductDetail(client, productFixture(7));

    prefetchProductDetail(client, 7);

    expect(detail).not.toHaveBeenCalled();
  });

  it('no consulta la API para ids locales de fixtures', () => {
    const detail = jest.spyOn(productService, 'detail');
    const client = createClient();

    prefetchProductDetail(client, 'wheelchair');

    expect(detail).not.toHaveBeenCalled();
    expect(client.getQueryData(productDetailKey('wheelchair'))).toBeUndefined();
  });
});
