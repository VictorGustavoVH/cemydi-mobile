import { configureHttpAuth } from '@/services/http/client';
import { accountService, legalText, rentalSchema } from '../account-service';
import { installAccountApiMock, RENTAL } from '../../../../tests/support/account-api-mock';
import { jsonResponse } from '../../../../tests/support/auth-api-mock';

describe('Contratos de las secciones de cuenta', () => {
  beforeEach(() => {
    configureHttpAuth({
      getAccessToken: () => 'fixture',
      getVersion: () => 1,
      refresh: async () => undefined,
      expired: async () => undefined,
    });
    installAccountApiMock();
  });
  it('consume historial paginado, detalle y reseñas con Bearer', async () => {
    expect((await accountService.rentals(2)).pagination.page).toBe(2);
    expect((await accountService.rental(RENTAL.id)).rental).toEqual(RENTAL);
    expect((await accountService.reviews()).reviews[0].rating).toBe(4);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://cemydi.test.invalid/rentals/mine?page=2&pageSize=8',
      expect.objectContaining({ cache: 'no-store', credentials: 'omit' }),
    );
    expect(new Headers(jest.mocked(fetch).mock.calls[0][1]?.headers).get('Authorization')).toBe(
      'Bearer fixture',
    );
  });
  it('cancela usando PATCH sin DTO inventado y propaga el rechazo del servidor', async () => {
    expect((await accountService.cancelRental(RENTAL.id)).rental.status).toBe('CANCELLED');
    expect(jest.mocked(fetch).mock.calls[0][1]).toMatchObject({ method: 'PATCH' });
    expect(jest.mocked(fetch).mock.calls[0][1]?.body).toBeUndefined();
    await expect(accountService.cancelRental(RENTAL.id)).rejects.toThrow(
      'Solo puedes cancelar solicitudes pendientes',
    );
  });
  it('rechaza respuesta incompatible y no confunde otra renta o documento', async () => {
    expect(rentalSchema.safeParse({ ...RENTAL, total: '500' }).success).toBe(false);
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ rental: { ...RENTAL, id: 'otra' } }));
    await expect(accountService.rental(RENTAL.id)).rejects.toMatchObject({ kind: 'parse' });
    jest.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        document: {
          slug: 'terminos-y-condiciones',
          title: 'Términos',
          description: '',
          sections: [],
        },
      }),
    );
    await expect(accountService.legal('politicas-de-privacidad')).rejects.toMatchObject({
      kind: 'parse',
    });
  });
  it('obtiene el texto legal público sin credenciales y conserva párrafos, caracteres y enlaces', async () => {
    await accountService.legal('politicas-de-privacidad');
    expect(new Headers(jest.mocked(fetch).mock.calls[0][1]?.headers).has('Authorization')).toBe(
      false,
    );
    expect(
      legalText(
        '<style>oculto</style><script>oculto</script><p>Datos &amp; m&#233;dicos</p><p><a href="https://cemydi.test/info">Información</a></p>',
      ),
    ).toBe('Datos & médicos\n\nInformación (https://cemydi.test/info)');
    expect(legalText('&#999999999;')).toBe('&#999999999;');
  });
});
