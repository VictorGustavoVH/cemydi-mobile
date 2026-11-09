import { configureHttpAuth } from '@/services/http/client';
import { accountDeletionService } from '../account-deletion-service';
import { jsonResponse } from '../../../../tests/support/auth-api-mock';

const receipt = {
  id: '0cb2c7f9-e344-41f7-a307-c3a6adbde419',
  status: 'WAITING_OBLIGATIONS',
  message: 'Solicitud registrada.',
};
beforeEach(() =>
  configureHttpAuth({
    getAccessToken: () => 'fixture',
    getVersion: () => 1,
    refresh: async () => undefined,
    expired: async () => undefined,
  }),
);
test('deletion uses the confirmed OTP contract without persisting or routing credentials', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(
    jsonResponse({
      message: 'Código enviado',
      resendAt: '2026-11-03T12:01:00.000Z',
      expiresAt: '2026-11-03T12:10:00.000Z',
    }),
  );
  await accountDeletionService.request('fixture@example.test');
  const [url, options] = jest.mocked(fetch).mock.calls[0];
  expect(url).toBe('https://cemydi.test.invalid/account-deletion/request');
  expect(options).toMatchObject({
    method: 'POST',
    credentials: 'omit',
    body: JSON.stringify({ correo: 'fixture@example.test' }),
  });
  expect(new Headers(options?.headers).has('Authorization')).toBe(false);
  jest.mocked(fetch).mockResolvedValueOnce(jsonResponse(receipt));
  await expect(accountDeletionService.confirm('fixture@example.test', '12345678')).resolves.toEqual(
    receipt,
  );
});
test('status is private, not cached and rejects inconsistent responses', async () => {
  jest
    .mocked(fetch)
    .mockResolvedValueOnce(jsonResponse({ request: receipt, pendingObligations: 1 }));
  expect((await accountDeletionService.status()).pendingObligations).toBe(1);
  const options = jest.mocked(fetch).mock.calls[0][1];
  expect(options?.cache).toBe('no-store');
  expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer fixture');
  jest
    .mocked(fetch)
    .mockResolvedValueOnce(
      jsonResponse({ request: { ...receipt, status: 'UNKNOWN' }, pendingObligations: -1 }),
    );
  await expect(accountDeletionService.status()).rejects.toMatchObject({ kind: 'parse' });
});
test.each([400, 429, 503])('HTTP %s never becomes a successful deletion', async (status) => {
  jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'Internal detail' }, status));
  await expect(
    accountDeletionService.confirm('fixture@example.test', '12345678'),
  ).rejects.toThrow();
});
