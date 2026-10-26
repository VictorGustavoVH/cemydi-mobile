export const AUTH_ACCOUNT = {
  nombre: 'Cliente CEMYDI',
  correo: 'cliente@cemydi.test',
  password: 'FixturePassword1!',
};
export const AUTH_USER = {
  id: 1,
  nombre: AUTH_ACCOUNT.nombre,
  correo: AUTH_ACCOUNT.correo,
  activo: true,
  rol: 'CLIENT',
  emailVerified: true,
  emailVerifiedAt: '2026-10-01T00:00:00.000Z',
} as const;
export const AUTH_SESSION = {
  user: AUTH_USER,
  accessToken: 'fixture-access-token',
  refreshToken: 'a'.repeat(64),
  accessExpiresInMs: 900000,
  refreshExpiresInMs: 604800000,
};
export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Stateful fake server, only installed explicitly by auth integration tests.
export function installAuthApiMock() {
  const accounts = new Map([[AUTH_ACCOUNT.correo, { ...AUTH_ACCOUNT }]]);
  jest.mocked(fetch).mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname;
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, string>;
    if (path === '/auth/mobile/login') {
      const account = accounts.get(body.correo);
      if (!account || body.password !== account.password)
        return jsonResponse({ message: 'Credenciales invalidas' }, 401);
      return jsonResponse({
        ...AUTH_SESSION,
        user: { ...AUTH_USER, nombre: account.nombre, correo: account.correo },
      });
    }
    if (path === '/auth/register') {
      accounts.set(body.correo, {
        nombre: body.nombre,
        correo: body.correo,
        password: body.password,
      });
      return jsonResponse({
        message: 'Si la solicitud es válida, recibirás instrucciones por correo.',
      });
    }
    if (
      path === '/auth/password-reset/verify-code' ||
      path === '/auth/email-verification/confirm-code'
    ) {
      if (body.codigo !== '00000000')
        return jsonResponse({ message: 'El código es inválido o expiró' }, 400);
      return jsonResponse({
        message: 'Código verificado correctamente',
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      });
    }
    if (path === '/auth/password-reset/confirm') {
      const account = accounts.get(body.correo);
      if (account) account.password = body.newPassword;
      return jsonResponse({ message: 'Contraseña actualizada correctamente' });
    }
    if (
      [
        '/auth/password-reset/request',
        '/auth/email-verification/send',
        '/auth/mobile/logout',
      ].includes(path)
    ) {
      return jsonResponse({ message: 'Solicitud recibida' });
    }
    throw new Error(`Endpoint sin fixture: ${path}`);
  });
}
