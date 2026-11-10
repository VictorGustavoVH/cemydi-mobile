const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createFixtureApi } = require('./maestro-api.cjs');
const { checkFlows } = require('./maestro-check.cjs');
const { createMetroEnv } = require('./maestro-e2e.cjs');

test('Metro: entorno headless sin .env ni valores públicos heredados', () => {
  const source = {
    PATH: 'herramientas',
    EXPO_PUBLIC_API_URL: 'https://otro.test.invalid',
    EXPO_PUBLIC_OTHER: 'no-heredar',
    EXPO_UNSTABLE_HEADLESS: '0',
    REACT_NATIVE_PACKAGER_HOSTNAME: 'otro.test.invalid',
  };
  const env = createMetroEnv(source, 4198);
  assert.equal(env.PATH, 'herramientas');
  assert.equal(env.EXPO_UNSTABLE_HEADLESS, '1');
  assert.equal(env.EXPO_NO_DOTENV, '1');
  assert.equal(env.EXPO_OFFLINE, '1');
  assert.equal(env.EXPO_PUBLIC_API_URL, 'http://127.0.0.1:4198');
  assert.equal(env.EXPO_PUBLIC_OTHER, undefined);
  assert.equal(env.REACT_NATIVE_PACKAGER_HOSTNAME, undefined);
  assert.equal(source.EXPO_UNSTABLE_HEADLESS, '0');
});

async function fixture(t) {
  const rejected = [];
  const server = createFixtureApi((request) => rejected.push(request));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (url, options) => {
    const response = await fetch(`${base}${url}`, options);
    return { status: response.status, body: await response.json() };
  };
  return { request, rejected };
}

test('fixture: búsqueda, disponibilidad y paginación son deterministas', async (t) => {
  const { request, rejected } = await fixture(t);
  const all = await request('/products?page=1&pageSize=24&sort=reciente');
  assert.deepEqual(
    all.body.products.map((product) => product.id),
    [1, 2],
  );
  assert.equal(all.body.pagination.total, 2);
  assert.deepEqual(
    (await request('/products?search=Equipo%20E2E%201')).body.products.map((p) => p.id),
    [1],
  );
  assert.equal((await request('/products?search=zzzinexistente')).body.pagination.total, 0);
  assert.deepEqual(
    (await request('/products?soloDisponibles=true')).body.products.map((p) => p.id),
    [1],
  );
  assert.equal((await request('/products?page=2&pageSize=1')).body.products[0].id, 2);
  assert.deepEqual(rejected, []);
});

test('fixture: detalle y auxiliares públicos sin imágenes remotas', async (t) => {
  const { request, rejected } = await fixture(t);
  const { body } = await request('/products/1');
  assert.equal(body.product.nombre, 'Equipo E2E 1');
  assert.equal(body.product.tipoAdquisicion, 'MIXTO');
  assert.equal(body.product.imageUrl, null);
  assert.deepEqual(body.product.images, []);
  assert.deepEqual((await request('/promotions')).body, { promotions: [] });
  assert.deepEqual((await request('/products/1/recommendations?limit=5')).body, {
    recommendations: [],
  });
  assert.equal((await request('/reviews/product/1')).body.summary.count, 0);
  assert.deepEqual(rejected, []);
});

test('fixture: rechaza escrituras, credenciales, rutas y filtros imprevistos', async (t) => {
  const { request, rejected } = await fixture(t);
  for (const [url, options, status] of [
    ['/unexpected-route', { method: 'POST' }, 405],
    ['/products', { headers: { authorization: 'Bearer ficticio' } }, 405],
    ['/products', { headers: { cookie: 'ficticio=1' } }, 405],
    ['/products/999', undefined, 404],
    ['/products?sort=precio_asc', undefined, 400],
    ['/products?marcas=otra', undefined, 400],
    ['/products?page=-1', undefined, 400],
    ['/products/999/recommendations?limit=5', undefined, 404],
  ])
    assert.equal((await request(url, options)).status, status);
  assert.equal(rejected.length, 8);
  assert.ok(!JSON.stringify(rejected).includes('ficticio'));
});

test('fixture: reseñas paginadas respetan el contrato público actual y rechazan parámetros ajenos', async (t) => {
  const { request } = await fixture(t);
  const page = await request('/reviews/product/1?page=1&pageSize=10');
  assert.equal(page.status, 200);
  assert.deepEqual(page.body.pagination, {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  });
  assert.deepEqual(page.body.reviews, []);
  assert.equal(page.body.summary.count, 0);
  assert.equal((await request('/reviews/product/1?page=1&pageSize=51')).status, 400);
  assert.equal((await request('/reviews/product/1?page=1&pageSize=10&other=1')).status, 400);
});

test('fixture: endpoints sintéticos de autenticación, perfil, carrito, rentas y ARCO', async (t) => {
  const { request, rejected } = await fixture(t);
  const loginOk = await request('/auth/mobile/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: 'cliente@cemydi.test', password: 'FixturePassword1!' }),
  });
  assert.equal(loginOk.status, 200);
  assert.equal(loginOk.body.user.nombre, 'Cliente CEMYDI');

  const loginBad = await request('/auth/mobile/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: 'erroneo@cemydi.test', password: 'Mal!' }),
  });
  assert.equal(loginBad.status, 401);

  const me = await request('/users/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.correo, 'cliente@cemydi.test');

  const cart = await request('/cart');
  assert.equal(cart.status, 200);
  assert.ok(Array.isArray(cart.body.items));

  const prefs = await request('/notifications/preferences');
  assert.equal(prefs.status, 200);
  assert.equal(prefs.body.preferences.pushEnabled, true);

  const rentals = await request('/rentals');
  assert.equal(rentals.status, 200);
  assert.equal(rentals.body.rentals[0].folio, 'REN-2026-001');

  const arco = await request('/account-deletion/me');
  assert.equal(arco.status, 200);
  assert.equal(arco.body.pendingObligations, 0);

  assert.deepEqual(rejected, []);
});

test('YAML: valida los trece escenarios y referencias de soporte', () => {
  assert.deepEqual(checkFlows(), [
    'catalog.yaml',
    'product-detail.yaml',
    'cart.yaml',
    'onboarding.yaml',
    'tabs.yaml',
    'auth.yaml',
    'profile.yaml',
    'cart-auth.yaml',
    'rental.yaml',
    'arco.yaml',
    'notifications.yaml',
    'offline.yaml',
    'permissions.yaml',
  ]);
});

test('YAML: falla ante sintaxis rota y soporte inexistente', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'cemydi-maestro-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'support'));
  writeFileSync(path.join(root, 'config.yaml'), 'flows: [catalog.yaml]');
  const file = path.join(root, 'catalog.yaml');
  writeFileSync(file, 'appId: ${APP_ID}\n---\n- runFlow: support/missing.yaml');
  assert.throws(() => checkFlows(root), /ENOENT/);
  writeFileSync(file, 'appId: [\n---\n- launchApp');
  assert.throws(() => checkFlows(root));
});

test('runner: validación sin ADB y rechazo de overrides o flujos ajenos', () => {
  const cli = path.join(
    path.dirname(require.resolve('../package.json')),
    'scripts/maestro-e2e.cjs',
  );
  const options = {
    encoding: 'utf8',
    env: { ...process.env, CEMYDI_ADB: 'herramienta-inexistente-e2e' },
  };
  assert.equal(spawnSync(process.execPath, [cli, '--check'], options).status, 0);
  for (const args of [
    ['--flow', '../otro.yaml'],
    ['-e', 'APP_ID=otro'],
  ]) {
    const result = spawnSync(process.execPath, [cli, ...args], options);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /No se admiten overrides/);
  }
});

test('runner físico: exige un flujo aislado y rechaza un puerto de driver inválido antes de ADB', () => {
  const cli = path.join(
    path.dirname(require.resolve('../package.json')),
    'scripts/maestro-e2e.cjs',
  );
  const options = {
    encoding: 'utf8',
    env: {
      ...process.env,
      CEMYDI_ADB: 'herramienta-inexistente-e2e',
      CEMYDI_E2E_DEVICE: 'synthetic-device',
      CEMYDI_E2E_PRELAUNCH_DEVICE: 'synthetic-device',
    },
  };
  const suite = spawnSync(process.execPath, [cli], options);
  assert.equal(suite.status, 1);
  assert.match(suite.stderr, /requiere un único --flow/);
  const invalidPort = spawnSync(process.execPath, [cli, '--flow', 'onboarding.yaml'], {
    ...options,
    env: { ...options.env, CEMYDI_E2E_DRIVER_PORT: '0' },
  });
  assert.equal(invalidPort.status, 1);
  assert.match(invalidPort.stderr, /CEMYDI_E2E_DRIVER_PORT debe ser un puerto/);
});
