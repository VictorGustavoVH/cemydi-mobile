const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createFixtureApi } = require('./maestro-api.cjs');
const { checkFlows } = require('./maestro-check.cjs');

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
    ['/auth/mobile/login', { method: 'POST', body: 'ficticio' }, 405],
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

test('YAML: valida los cinco escenarios y referencias de soporte', () => {
  assert.deepEqual(checkFlows(), [
    'catalog.yaml',
    'product-detail.yaml',
    'cart.yaml',
    'onboarding.yaml',
    'tabs.yaml',
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
