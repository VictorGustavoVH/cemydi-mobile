import { ApiError, getFriendlyErrorMessage, isApiError, isRetryableApiError } from '../api-error';

describe('Política de errores HTTP', () => {
  it.each([400, 401, 403, 404, 409, 429])('no reintenta el estado %i', (status) => {
    expect(isRetryableApiError(new ApiError('Error', { kind: 'http', status }))).toBe(false);
  });

  it.each([500, 502, 503])('permite reintentar el estado %i', (status) => {
    expect(isRetryableApiError(new ApiError('Error', { kind: 'http', status }))).toBe(true);
  });

  it.each(['network', 'timeout'] as const)('permite reintentar %s', (kind) => {
    expect(isRetryableApiError(new ApiError('Error', { kind }))).toBe(true);
  });

  it.each(['abort', 'parse'] as const)('no reintenta %s', (kind) => {
    expect(isRetryableApiError(new ApiError('Error', { kind }))).toBe(false);
  });

  it('distingue errores desconocidos y conserva la causa y datos', () => {
    const cause = new Error('Causa');
    const data = { message: 'Entrada inválida' };
    const error = new ApiError('Entrada inválida', { kind: 'http', status: 400, cause, data });
    expect(isApiError(error)).toBe(true);
    expect(error).toMatchObject({ name: 'ApiError', status: 400, cause, data });
    expect(isApiError(cause)).toBe(false);
    expect(isRetryableApiError(cause)).toBe(false);
    expect(isRetryableApiError(null)).toBe(false);
  });

  it('devuelve mensajes amigables y no técnicos para el usuario', () => {
    expect(
      getFriendlyErrorMessage(
        new ApiError('No fue posible conectar con la API.', { kind: 'network' }),
      ),
    ).toBe('No fue posible conectar con el servidor. Comprueba tu conexión e intenta de nuevo.');
    expect(
      getFriendlyErrorMessage(new ApiError('La API falló', { kind: 'http', status: 500 })),
    ).toBe('El servicio no se encuentra disponible temporalmente. Intenta más tarde.');
    expect(getFriendlyErrorMessage(new Error('Network request failed'))).toBe(
      'No fue posible conectar con el servidor. Comprueba tu conexión e intenta de nuevo.',
    );
    expect(getFriendlyErrorMessage(new Error('Mensaje de negocio válido'))).toBe(
      'Mensaje de negocio válido',
    );
  });
});
