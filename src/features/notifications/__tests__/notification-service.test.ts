import { configureHttpAuth } from '@/services/http/client';
import { ApiError } from '@/services/http/api-error';
import { jsonResponse } from '../../../../tests/support/auth-api-mock';
import { notificationService } from '../notification-service';
import { notificationDestination } from '../notification-destination';
import { safeProfileDestination } from '@/features/auth/auth-destination';

const preferences = { pushEnabled: false, system: true, offers: false, rentals: true };
describe('notification API contracts', () => {
  it('marks the complete account as read without sending a page or a list of ids', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'Leídas' }));
    await notificationService.readAll();
    const [url, options] = jest.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('/notifications/read-all');
    expect(options?.method).toBe('PATCH');
    expect(options?.body).toBeUndefined();
  });
  it('resolves notification destinations directly and leaves announcements in the inbox', () => {
    expect(notificationDestination({ destinationType: 'PRODUCT', destinationId: '12' })).toEqual({
      pathname: '/producto/[id]',
      params: { id: '12' },
    });
    expect(notificationDestination({ destinationType: 'RENTAL', destinationId: 'rental' })).toEqual(
      { pathname: '/perfil/renta/[id]', params: { id: 'rental' } },
    );
    expect(notificationDestination({ destinationType: 'PROMOTION', destinationId: '5' })).toEqual({
      pathname: '/perfil/oferta/[id]',
      params: { id: '5' },
    });
    expect(notificationDestination({ destinationType: 'ACCOUNT', destinationId: null })).toBe(
      '/perfil/seguridad',
    );
    expect(notificationDestination({ destinationType: 'NONE', destinationId: null })).toBeNull();
  });
  it('keeps notifications without a valid destination id in the inbox', () => {
    expect(
      notificationDestination({ destinationType: 'PRODUCT', destinationId: 'bed' }),
    ).toBeNull();
    expect(notificationDestination({ destinationType: 'PRODUCT', destinationId: null })).toBeNull();
    expect(
      notificationDestination({ destinationType: 'PROMOTION', destinationId: 'oferta-x' }),
    ).toBeNull();
    expect(notificationDestination({ destinationType: 'RENTAL', destinationId: '' })).toBeNull();
    expect(notificationDestination({ destinationType: 'RENTAL', destinationId: null })).toBeNull();
  });
  beforeEach(() =>
    configureHttpAuth({
      getAccessToken: () => 'fixture',
      getVersion: () => 1,
      refresh: async () => undefined,
      expired: async () => undefined,
    }),
  );
  it('uses the authenticated transport and saves shared preferences', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ preferences }));
    expect(await notificationService.savePreferences(preferences)).toEqual({ preferences });
    const [url, options] = jest.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('/notifications/preferences');
    expect(options?.method).toBe('PATCH');
    expect(options?.body).toBe(JSON.stringify(preferences));
    expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer fixture');
  });
  it('validates inbox, pagination and runtime response shapes', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({ items: [], unreadCount: 0, total: 0, page: 2, pageSize: 20 }),
      );
    expect(await notificationService.inbox(2, 'OFFER')).toMatchObject({ page: 2, items: [] });
    expect(String(jest.mocked(fetch).mock.calls[0][0])).toContain('page=2&category=OFFER');
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ preferences: { pushEnabled: 'false' } }));
    await expect(notificationService.preferences()).rejects.toBeInstanceOf(ApiError);
  });
  it('encodes detail identifiers and registers native tokens through the same session', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ id: 'subscription' }));
    await notificationService.register('ExpoPushToken[fixture]');
    expect(jest.mocked(fetch).mock.calls[0][1]?.body).toBe(
      JSON.stringify({ channel: 'EXPO', endpoint: 'ExpoPushToken[fixture]' }),
    );
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ item: {} }));
    await expect(notificationService.detail('other/id')).rejects.toBeInstanceOf(ApiError);
    expect(String(jest.mocked(fetch).mock.calls[1][0])).toContain('/notifications/other%2Fid');
  });
  it('allows internal notification destinations after login and rejects arbitrary URLs', () => {
    expect(safeProfileDestination('/perfil/notificaciones/abc123')).toBe(
      '/perfil/notificaciones/abc123',
    );
    expect(safeProfileDestination('/perfil/notificaciones/preferencias')).toBe(
      '/perfil/notificaciones/preferencias',
    );
    expect(safeProfileDestination('/perfil/notificaciones/../../admin')).toBe('/perfil');
    expect(safeProfileDestination('https://evil.test')).toBe('/perfil');
  });
});
