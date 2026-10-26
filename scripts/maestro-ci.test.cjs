const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const bash =
  process.platform === 'win32'
    ? path.join(process.env.ProgramFiles, 'Git', 'bin', 'bash.exe')
    : 'bash';
const shellPath = (value) =>
  process.platform === 'win32'
    ? value.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`)
    : value;

function run(t, overrides = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'cemydi-maestro-ci-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const environment = path.join(directory, 'environment.sh');
  const calls = path.join(directory, 'calls.log');
  // Replace commands inside Bash; these tests never contact ADB or run Maestro.
  writeFileSync(
    environment,
    `adb() {
  printf '%s\\n' "$*" >> "$CALLS"
  case "$*" in
    *'shell getprop ro.kernel.qemu') printf '%s\\n' "$QEMU" ;;
    *' install '*) return "$INSTALL_STATUS" ;;
    *'logcat -d') printf 'fixture log'; return "$LOGCAT_STATUS" ;;
    *'wait-for-handler '*) return "$PACKAGE_STATUS" ;;
    *'wait-for-background-handler '*) return "$PACKAGE_STATUS" ;;
    *'dumpsys activity lastanr') printf '%s' "$ANR_REPORT" ;;
  esac
}
npm() {
  printf 'npm %s\\n' "$*" >> "$CALLS"
  [[ "$CEMYDI_E2E_DEVICE" == "$ANDROID_SERIAL" && "$CEMYDI_E2E_ALLOW_CLEAR" == "$ANDROID_SERIAL" ]] || return 99
  return "$TEST_STATUS"
}
`,
  );
  const result = spawnSync(bash, [shellPath(path.resolve('scripts/maestro-ci.sh'))], {
    cwd: directory,
    encoding: 'utf8',
    timeout: 15000,
    env: {
      ...process.env,
      BASH_ENV: shellPath(environment),
      CALLS: shellPath(calls),
      GITHUB_ACTIONS: 'true',
      RUNNER_ENVIRONMENT: 'github-hosted',
      ANDROID_SERIAL: 'emulator-5554',
      QEMU: '1',
      INSTALL_STATUS: '0',
      TEST_STATUS: '0',
      LOGCAT_STATUS: '0',
      PACKAGE_STATUS: '0',
      ANR_REPORT: 'fixture ANR',
      CEMYDI_E2E_DEVICE: '',
      CEMYDI_E2E_ALLOW_CLEAR: '',
      ...overrides,
    },
  });
  assert.ifError(result.error);
  return {
    ...result,
    calls: existsSync(calls) ? readFileSync(calls, 'utf8') : '',
    log: path.join(directory, 'test-results/maestro/ci/logcat.log'),
  };
}

test('CI: rechaza ejecución local, runners propios y otros seriales antes de usar ADB', (t) => {
  for (const overrides of [
    { GITHUB_ACTIONS: 'false' },
    { RUNNER_ENVIRONMENT: 'self-hosted' },
    { ANDROID_SERIAL: 'telefono-personal' },
  ]) {
    const result = run(t, overrides);
    assert.equal(result.status, 1);
    assert.equal(result.calls, '');
  }
});

test('CI: rechaza dispositivos que no se identifican como emulador', (t) => {
  const result = run(t, { QEMU: '0' });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.calls, /install|npm/);
});

test('CI: instalación fallida conserva el código y no ejecuta los flujos', (t) => {
  const result = run(t, { INSTALL_STATUS: '23' });
  assert.equal(result.status, 23);
  assert.doesNotMatch(result.calls, /npm/);
  assert.equal(readFileSync(result.log, 'utf8'), 'fixture log');
});

test('CI: conserva el fallo E2E aunque falle la recolección de logcat', (t) => {
  const result = run(t, { TEST_STATUS: '17', LOGCAT_STATUS: '29' });
  assert.equal(result.status, 17);
  assert.match(result.calls, /npm run test:e2e/);
  assert.match(result.stderr, /No se pudo recoger logcat/);
});

test('CI: autoriza solo su emulador, ejecuta la suite y conserva logcat', (t) => {
  const result = run(t);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.calls, /-s emulator-5554 install test-results\/apk\/app-debug.apk/);
  assert.match(result.calls, /npm run test:e2e/);
  assert.equal(readFileSync(result.log, 'utf8'), 'fixture log');
  assert.equal(
    readFileSync(path.join(path.dirname(result.log), 'lastanr-after.txt'), 'utf8'),
    'fixture ANR',
  );
  assert.ok(
    result.calls.indexOf('wait-for-background-handler') < result.calls.indexOf(' install '),
  );
});

test('CI: Package Manager no disponible falla antes de instalar o ejecutar flujos', (t) => {
  const result = run(t, { PACKAGE_STATUS: '31' });
  assert.equal(result.status, 31);
  assert.doesNotMatch(result.calls, /install|npm/);
  assert.equal(readFileSync(result.log, 'utf8'), 'fixture log');
});

test('CI: ANR previo falla antes de instalar y conserva diagnóstico sin cerrar diálogos', (t) => {
  const result = run(t, { ANR_REPORT: 'ANR time: fixture\nReason: no focused window' });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.calls, /install|npm|force-stop|keyevent/);
  assert.match(result.stderr, /ya tiene un ANR/);
  const before = path.join(path.dirname(result.log), 'lastanr-before.txt');
  assert.match(readFileSync(before, 'utf8'), /no focused window/);
});
