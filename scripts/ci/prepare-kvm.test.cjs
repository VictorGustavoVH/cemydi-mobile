const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { prepareKvm } = require('./prepare-kvm.cjs');

const ready = { exists: true, characterDevice: true, readable: true, writable: true };

test('KVM: no cambia permisos si el dispositivo ya es accesible', () => {
  assert.deepEqual(
    prepareKvm({ inspect: () => ready, grantAccess: () => assert.fail('chmod innecesario') }),
    ready,
  );
});

test('KVM: corrige permisos de forma síncrona y vuelve a comprobarlos', () => {
  let granted = false;
  const stages = [];
  prepareKvm({
    inspect: () => (granted ? ready : { ...ready, writable: false }),
    grantAccess: () => {
      granted = true;
    },
    record: (stage) => stages.push(stage.stage),
  });
  assert.equal(granted, true);
  assert.deepEqual(stages, ['inspect-before', 'grant-access', 'inspect-after']);
});

test('KVM: nodo ausente o no válido falla sin intentar chmod', () => {
  for (const device of [{ exists: false }, { ...ready, characterDevice: false }])
    assert.throws(
      () =>
        prepareKvm({
          inspect: () => device,
          grantAccess: () => assert.fail('no debe conceder acceso'),
        }),
      /dispositivo de caracteres/,
    );
});

test('KVM: propaga errores de permisos y no simula disponibilidad', () => {
  const inaccessible = () => ({ ...ready, readable: false });
  assert.throws(
    () =>
      prepareKvm({
        inspect: inaccessible,
        grantAccess: () => {
          throw new Error('sudo rechazado');
        },
      }),
    /sudo rechazado/,
  );
  assert.throws(
    () => prepareKvm({ inspect: inaccessible, grantAccess: () => {} }),
    /sigue sin lectura/,
  );
});

test('KVM: CLI fuera de GitHub falla y persiste diagnóstico sin preparar dispositivos', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'cemydi-kvm-guard-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [require.resolve('./prepare-kvm.cjs')], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_ACTIONS: 'false' },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  const report = JSON.parse(
    readFileSync(path.join(root, 'test-results/maestro/ci/kvm.json'), 'utf8'),
  );
  assert.equal(report.passed, false);
  assert.deepEqual(report.stages, []);
  assert.match(report.error, /solo se permite/);
});
