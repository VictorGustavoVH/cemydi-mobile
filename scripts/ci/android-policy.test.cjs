const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const { execFileSync, spawnSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { selectAndroid, changedFiles, evaluateResult } = require('./android-policy.cjs');

test('selección: documentación y herramientas ajenas a Maestro no requieren APK', () => {
  for (const file of [
    'README.md',
    'docs/TESTING.md',
    '.github/pull_request_template.md',
    'tests/support/product-fixtures.ts',
    'tests/integration/catalog-cart.test.tsx',
    'src/features/catalog/__tests__/CatalogScreen.test.tsx',
    'src/services/products/product-service.spec.ts',
    'scripts/load/cli.cjs',
    'scripts/performance/metrics.cjs',
    'scripts/test-summary.cjs',
    '.github/workflows/quality.yml',
  ])
    assert.equal(selectAndroid([file]).required, false, file);
});

test('selección: runtime, fixtures E2E, dependencias y pipeline requieren Android', () => {
  for (const file of [
    'src/app/_layout.tsx',
    'src/data/product-detail-preview.ts',
    'src/services/products/product-service.ts',
    'src/components/ui/ProductCard.tsx',
    'scripts/maestro-api.cjs',
    'scripts/maestro-e2e.cjs',
    '.maestro/cart.yaml',
    'plugins/with-android-java.cjs',
    'package.json',
    'package-lock.json',
    'app.config.js',
    'app.json',
    'eas.json',
    'assets/icons/app-icon.png',
    '.github/workflows/tests.yml',
    'scripts/ci/android-policy.cjs',
    'android/gradle.properties',
    'ruta-no-clasificada/config.json',
  ])
    assert.equal(selectAndroid([file]).required, true, file);
  assert.equal(selectAndroid(['docs/TESTING.md', 'scripts/maestro-api.cjs']).required, true);
});

test('selección: manual y solicitud explícita fuerzan la cadena completa', () => {
  assert.equal(selectAndroid([], { eventName: 'workflow_dispatch' }).required, true);
  assert.equal(selectAndroid(['README.md'], { force: true }).required, true);
  assert.equal(selectAndroid([]).required, false);
});

test('diff: NUL y --no-renames conservan rutas borradas/renombradas', (t) => {
  const oldSha = process.env.GITHUB_SHA;
  process.env.GITHUB_SHA = 'b'.repeat(40);
  t.after(() => {
    if (oldSha === undefined) delete process.env.GITHUB_SHA;
    else process.env.GITHUB_SHA = oldSha;
  });
  const base = 'a'.repeat(40);
  const files = changedFiles('pull_request', { pull_request: { base: { sha: base } } }, (args) => {
    assert.deepEqual(args, [
      'diff',
      '--name-only',
      '--no-renames',
      '-z',
      base,
      'b'.repeat(40),
      '--',
    ]);
    return Buffer.from('src/data/fixture.ts\0docs/fixture.md\0docs/archivo con\nsalto.md\0');
  });
  assert.equal(files.length, 3);
  assert.equal(selectAndroid(files).required, true);
  assert.equal(changedFiles('push', { before: '0'.repeat(40) }), null);
  assert.throws(() => changedFiles('push', {}), /revisiones válidas/);
  assert.throws(
    () =>
      changedFiles('push', { before: base }, () => {
        throw new Error('git sin historia');
      }),
    /sin historia/,
  );
});

function jobs(required) {
  return {
    changes: { result: 'success', outputs: { android_required: String(required) } },
    tests: { result: 'success' },
    maestro_checks: { result: 'success' },
    build_android: { result: required ? 'success' : 'skipped' },
    maestro: { result: required ? 'success' : 'skipped' },
  };
}

test('resultado: éxito completo y omisión documental legítima aprueban', () => {
  assert.equal(evaluateResult(jobs(true)).passed, true);
  assert.equal(evaluateResult(jobs(false)).passed, true);
});

test('resultado: fallos, cancelaciones y omisiones inesperadas nunca aprueban', () => {
  for (const required of [true, false]) {
    for (const job of ['changes', 'tests', 'maestro_checks', 'build_android', 'maestro']) {
      for (const result of ['failure', 'cancelled', 'skipped', 'success']) {
        const needs = jobs(required);
        if (needs[job].result === result) continue;
        needs[job].result = result;
        assert.equal(evaluateResult(needs).passed, false, `${required}/${job}/${result}`);
      }
    }
  }
  for (const invalid of [undefined, '', 'FALSE', true]) {
    const needs = jobs(false);
    needs.changes.outputs.android_required = invalid;
    assert.equal(evaluateResult(needs).passed, false);
  }
  assert.equal(evaluateResult({}).passed, false);
});

test('CLI: selección documental y manual exportan decisiones; resultado falla con Maestro rojo', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'cemydi-ci-policy-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git(['init', '--quiet']);
  git(['config', 'user.name', 'CI Test']);
  git(['config', 'user.email', 'ci@example.invalid']);
  writeFileSync(path.join(root, 'README.md'), 'base');
  git(['add', 'README.md']);
  git(['commit', '--quiet', '-m', 'base']);
  const base = git(['rev-parse', 'HEAD']);
  writeFileSync(path.join(root, 'README.md'), 'documentation');
  git(['add', 'README.md']);
  git(['commit', '--quiet', '-m', 'docs']);
  const event = path.join(root, 'event.json');
  const output = path.join(root, 'output.txt');
  writeFileSync(event, JSON.stringify({ before: base }));
  const cli = path.resolve('scripts/ci/android-policy.cjs');
  const env = {
    ...process.env,
    GITHUB_EVENT_NAME: 'push',
    GITHUB_EVENT_PATH: event,
    GITHUB_OUTPUT: output,
    GITHUB_SHA: git(['rev-parse', 'HEAD']),
    GITHUB_STEP_SUMMARY: path.join(root, 'summary.md'),
  };
  const run = (command, overrides = {}) =>
    spawnSync(process.execPath, [cli, command], {
      cwd: root,
      encoding: 'utf8',
      env: { ...env, ...overrides },
    });
  assert.equal(run('select').status, 0);
  assert.equal(readFileSync(output, 'utf8'), 'android_required=false\n');
  assert.equal(run('select', { GITHUB_EVENT_NAME: 'workflow_dispatch' }).status, 0);
  assert.match(readFileSync(output, 'utf8'), /android_required=true/);
  writeFileSync(event, JSON.stringify({ pull_request: { labels: [{ name: 'ci:android' }] } }));
  assert.equal(run('select', { GITHUB_EVENT_NAME: 'pull_request' }).status, 0);
  const needs = jobs(true);
  needs.maestro.result = 'failure';
  assert.equal(run('result', { JOB_RESULTS: JSON.stringify(needs) }).status, 1);
  assert.equal(run('result', { JOB_RESULTS: JSON.stringify(jobs(false)) }).status, 0);
  assert.equal(run('result', { JOB_RESULTS: '{roto' }).status, 1);
});
