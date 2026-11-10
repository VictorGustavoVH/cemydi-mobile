const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const { createFixtureApi } = require('./maestro-api.cjs');

test('physical fixture rotates refresh, rejects reuse and revokes without logging credentials', async (t) => {
  const events = [];
  const api = createFixtureApi(
    () => {},
    (event) => events.push(event),
  );
  await new Promise((resolve) => api.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    api.closeAllConnections();
    await new Promise((resolve) => api.close(resolve));
  });
  const request = (route, body) =>
    fetch(`http://127.0.0.1:${api.address().port}${route}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const login = await (
    await request('/auth/mobile/login', {
      correo: 'usuario2@cemydi.test',
      password: 'FixturePassword2!',
    })
  ).json();
  const refresh = await (
    await request('/auth/mobile/refresh', { refreshToken: login.refreshToken })
  ).json();
  assert.equal(refresh.user.id, 20);
  assert.notEqual(refresh.refreshToken, login.refreshToken);
  assert.equal(
    (await request('/auth/mobile/refresh', { refreshToken: login.refreshToken })).status,
    401,
  );
  await request('/auth/mobile/logout', { refreshToken: refresh.refreshToken });
  assert.equal(
    (await request('/auth/mobile/refresh', { refreshToken: refresh.refreshToken })).status,
    401,
  );
  assert.ok(!JSON.stringify(events).includes(login.refreshToken));
  assert.ok(!JSON.stringify(events).includes('password'));
});

test('physical upload fixture accepts only the synthetic image and a single file', async (t) => {
  const api = createFixtureApi();
  await new Promise((resolve) => api.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    api.closeAllConnections();
    await new Promise((resolve) => api.close(resolve));
  });
  const base = `http://127.0.0.1:${api.address().port}`;
  await fetch(`${base}/cart/items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productId: 1, mode: 'RENTA', quantity: 1 }),
  });
  const image = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS0cAAAAASUVORK5CYII=',
    'base64',
  );
  const upload = async (name, bytes, extra = false) => {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: 'image/png' }), name);
    if (extra) form.append('file', new Blob([bytes], { type: 'image/png' }), name);
    return fetch(`${base}/rentals/cart-items/101/prescription`, { method: 'POST', body: form });
  };
  assert.equal((await upload('other.png', image)).status, 400);
  assert.equal((await upload('CEMYDI_SYNTHETIC_ONLY.png', Buffer.from('wrong'))).status, 400);
  assert.equal((await upload('CEMYDI_SYNTHETIC_ONLY.png', image, true)).status, 400);
  const response = await upload('CEMYDI_SYNTHETIC_ONLY.png', image);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).document.bytes, image.length);
});
