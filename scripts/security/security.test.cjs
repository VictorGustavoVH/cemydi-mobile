const assert = require('node:assert/strict');
const { test } = require('node:test');
const { once } = require('node:events');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { checkSast, checkZap } = require('./policy.cjs');
const { createSmokeFixture, baselineArgs, contextXml } = require('./dast-smoke.cjs');
const { sourceTargets, sourceFiles, verifyRuleFixtures } = require('./sast.cjs');
const tools = require('./tools.json');

const sast = (results = []) => ({
  version: tools.semgrep,
  errors: [],
  results,
  paths: { scanned: ['src/example.ts', 'scripts/example.cjs'] },
});
const finding = (risk, severity = 'ERROR') => ({
  check_id: 'test',
  path: 'src/example.ts',
  start: { line: 1 },
  extra: {
    severity,
    metadata: { 'cemydi-risk': risk },
    message: 'Prueba',
    lines: 'contenido que no debe publicarse',
    metavars: { sensitive: 'no publicar' },
  },
});
const zap = (risk = '0') => ({
  '@version': tools.zap,
  site: [
    {
      '@name': tools.fixtureTarget,
      alerts: [
        {
          pluginid: '10000',
          name: 'Alerta sintética',
          riskcode: risk,
          riskdesc: 'Synthetic',
          instances: [{ uri: tools.fixtureTarget }],
        },
      ],
    },
  ],
});

test('SAST bloquea HIGH/CRITICAL y conserva MEDIUM sin convertirlo en confirmado', () => {
  for (const risk of ['HIGH', 'CRITICAL'])
    assert.equal(checkSast(sast([finding(risk)]), 0).passed, false);
  const report = checkSast(sast([finding('MEDIUM', 'WARNING')]), 0);
  assert.equal(report.passed, true);
  assert.equal(report.findings[0].triage, 'pending-review');
  assert.ok(!JSON.stringify(report).includes('no publicar'));
  assert.ok(!JSON.stringify(report).includes('contenido que'));
});

test('SAST falla ante errores del proceso, parseo, versiones incompatibles y cobertura vacía', () => {
  for (const code of [1, 2, 3, 7, null]) assert.throws(() => checkSast(sast(), code));
  assert.throws(() => checkSast({ ...sast(), errors: [{ type: 'ParseError' }] }, 0));
  assert.throws(() => checkSast({ ...sast(), version: '0.0.0' }, 0));
  assert.throws(() => checkSast({ ...sast(), paths: { scanned: [] } }, 0));
  assert.throws(() => checkSast({ ...sast(), paths: { scanned: ['src/only.ts'] } }, 0));
  assert.throws(() => checkSast(sast([finding('UNKNOWN')]), 0));
  assert.throws(() => checkSast(sast([finding('LOW')]), 0));
  assert.throws(() => checkSast(null, 0));
});

test('ZAP bloquea High real (riskcode 3) sin inventar una severidad Critical', () => {
  assert.equal(checkZap(zap('3'), 2).passed, false);
  assert.equal(checkZap(zap('2'), 2).passed, true);
  assert.equal(checkZap(zap('1'), 1).passed, false);
  assert.equal(checkZap(zap('0'), 0).backendDast, 'pending-authorized-isolated-backend');
});

test('ZAP falla ante errores, reportes vacíos o inválidos y objetivos externos', () => {
  for (const code of [3, 125, 137, null]) assert.throws(() => checkZap(zap(), code));
  for (const report of [
    null,
    {},
    { ...zap(), site: [] },
    { ...zap(), '@version': '0' },
    zap('invalid'),
  ])
    assert.throws(() => checkZap(report, 0));
  const external = zap();
  external.site[0]['@name'] = 'https://example.invalid';
  assert.throws(() => checkZap(external, 0));
  const escaped = zap();
  escaped.site[0].alerts[0].instances[0].uri = 'http://127.0.0.1:4000/';
  assert.throws(() => checkZap(escaped, 0));
  const wrongPath = zap();
  wrongPath.site[0].alerts[0].instances[0].uri = new URL('/auth', tools.fixtureTarget).href;
  assert.throws(() => checkZap(wrongPath, 0));
});

test('el objetivo y los argumentos de ZAP están fijados, limitados y no contienen ataques activos', () => {
  const args = baselineArgs('/tmp/cemydi-fixture', 'test-container', { uid: 1000, gid: 1000 });
  assert.equal(args[args.indexOf('-t') + 1], 'http://127.0.0.1:4199/');
  assert.ok(args.includes('zap-baseline.py'));
  assert.ok(!args.some((arg) => /zap-(full|api)-scan|--ajax-spider/.test(arg)));
  assert.ok(args.includes('--autooff'));
  assert.equal(args[args.indexOf('-m') + 1], '1');
  assert.equal(args[args.indexOf('-T') + 1], '3');
  assert.match(tools.zapImage, /:2\.17\.0@sha256:[a-f0-9]{64}$/);
  assert.ok(contextXml().includes('http://127\\.0\\.0\\.1:4199/'));
  assert.ok(!args.includes('-I'));
});

test('la verificación de reglas exige resultados reales exactos y detecta falsos negativos y positivos', () => {
  const source = '// ruleid: test\neval(input);\n// ok: test\nJSON.parse(input);';
  const report = {
    ...sast([finding('HIGH')]),
    results: [{ check_id: 'test', start: { line: 2 } }],
  };
  assert.equal(verifyRuleFixtures(source, report), 1);
  assert.throws(() => verifyRuleFixtures(source, { ...report, results: [] }));
  assert.throws(() =>
    verifyRuleFixtures(source, {
      ...report,
      results: [...report.results, { check_id: 'test', start: { line: 4 } }],
    }),
  );
  assert.throws(() => verifyRuleFixtures(source, { ...report, errors: [{ type: 'ParseError' }] }));
});

test('el fixture escucha en loopback, solo admite lecturas y no ofrece redirecciones o autenticación', async () => {
  const server = createSmokeFixture();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(`${base}/health`);
    assert.deepEqual(await health.json(), { fixture: 'cemydi-security-smoke', backend: false });
    assert.equal(health.headers.get('location'), null);
    assert.equal((await fetch(base)).status, 200);
    assert.equal((await fetch(`${base}/fixture`)).status, 200);
    assert.equal((await fetch(`${base}/missing`)).status, 404);
    assert.equal((await fetch(`${base}/fixture`, { method: 'POST' })).status, 405);
    assert.equal(
      (await fetch(`${base}/health`, { headers: { authorization: 'synthetic' } })).status,
      405,
    );
    assert.equal(
      (await fetch(`${base}/health`, { headers: { cookie: 'synthetic=1' } })).status,
      405,
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('SAST incluye código, scripts y configuración; el workflow no usa pull_request_target ni secretos', () => {
  const targets = sourceTargets();
  for (const target of [
    'src',
    'scripts',
    'plugins',
    'app.config.js',
    'app.json',
    'metro.config.js',
  ])
    assert.ok(targets.includes(target));
  const files = sourceFiles();
  assert.ok(files.includes('src/features/auth/services/auth-session.ts'));
  assert.ok(files.includes('src/services/products/product-service.ts'));
  assert.ok(files.includes('scripts/security/sast.cjs'));
  const workflow = readFileSync(
    path.join(
      path.dirname(require.resolve('../../package.json')),
      '.github/workflows/security.yml',
    ),
    'utf8',
  );
  assert.ok(!workflow.includes('pull_request_target'));
  assert.ok(!workflow.includes('secrets.'));
  assert.ok(workflow.includes('contents: read'));
  assert.ok(workflow.includes('backend pendiente'));
  assert.ok(workflow.includes("github.event_name == 'workflow_dispatch' && inputs.dast_smoke"));
  assert.ok(workflow.includes("github.event.label.name == 'seguridad:dast-fixture'"));
  assert.ok(workflow.includes('github.actor == github.repository_owner'));
  assert.ok(
    workflow.includes('github.event.pull_request.head.repo.full_name == github.repository'),
  );
});
