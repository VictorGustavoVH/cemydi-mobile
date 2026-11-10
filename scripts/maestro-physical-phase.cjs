/* global __dirname */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const name = process.argv[2];
if (!/^[a-z-]+$/.test(name || '')) throw new Error('Nombre de fase inválido.');
const serial = process.env.CEMYDI_E2E_DEVICE;
if (!serial) throw new Error('Configura CEMYDI_E2E_DEVICE con el dispositivo autorizado.');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'scripts/physical-flows', `${name}.yaml`);
if (!fs.existsSync(source)) throw new Error('Fase inexistente.');
const current = JSON.parse(fs.readFileSync(path.join(root, '.tools/runtime-final-current.json')));
const firstOutput = path.join(current.output, name);
const output = fs.existsSync(firstOutput) ? `${firstOutput}-${Date.now()}` : firstOutput;
fs.mkdirSync(output, { recursive: true });
const flow = path.join(output, `${name}.yaml`);
fs.copyFileSync(source, flow);
// Same stale host-session cleanup used by maestro-e2e.cjs. The phase runner
// is sequential; no app data or Android permission is touched here.
fs.rmSync(path.join(os.homedir(), '.maestro', 'sessions'), { force: true });
const result = spawnSync(
  process.execPath,
  [
    path.join(__dirname, 'maestro.cjs'),
    '--device',
    serial,
    'test',
    '--no-reinstall-driver',
    '--driver-host-port',
    '7001',
    '--format',
    'junit',
    '--output',
    path.join(output, 'results.xml'),
    '--test-output-dir',
    output,
    '--debug-output',
    output,
    '-e',
    'APP_ID=com.cemydi.app',
    flow,
  ],
  { cwd: root, encoding: 'utf8', timeout: 240000 },
);
fs.writeFileSync(
  path.join(output, 'console.log'),
  `${result.stdout || ''}\n${result.stderr || ''}`,
);
fs.writeFileSync(
  path.join(output, 'phase.json'),
  JSON.stringify(
    {
      name,
      exitCode: result.status,
      error: result.error?.message,
      finishedAt: new Date().toISOString(),
      clearState: false,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({ name, exitCode: result.status, error: result.error?.message, output }),
);
process.exitCode = result.status ?? 1;
