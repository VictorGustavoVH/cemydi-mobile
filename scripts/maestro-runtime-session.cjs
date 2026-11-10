/* global __dirname */
// Dedicated physical-test infrastructure. No installation, pm clear, global
// settings, other-app operations, or credential/storage inspection.
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { createFixtureApi } = require('./maestro-api.cjs');
const { createMetroEnv } = require('./maestro-e2e.cjs');

async function main() {
  process.chdir(path.resolve(__dirname, '..'));
  const serial = process.env.CEMYDI_E2E_DEVICE;
  if (!serial) throw new Error('Configura CEMYDI_E2E_DEVICE con el dispositivo autorizado.');
  const adb = (...args) =>
    execFileSync('adb', ['-s', serial, ...args], { encoding: 'utf8', timeout: 30000 });
  if (adb('get-state').trim() !== 'device') throw new Error('Dispositivo no disponible.');
  if (!adb('shell', 'dumpsys', 'package', 'com.cemydi.app').includes('DEBUGGABLE'))
    throw new Error('Se requiere Development Build.');
  const output = path.resolve(
    'test-results/runtime-final',
    new Date().toISOString().replace(/[:.]/g, '-'),
  );
  fs.mkdirSync(output, { recursive: true });
  const events = [];
  const unexpected = [];
  const api = createFixtureApi(
    (event) => unexpected.push(event),
    (event) => {
      events.push({ at: new Date().toISOString(), ...event });
      fs.writeFileSync(path.join(output, 'requests.json'), JSON.stringify(events, null, 2));
    },
  );
  const reversed = [];
  let metro;
  const log = fs.createWriteStream(path.join(output, 'metro.log'));
  try {
    await new Promise((resolve, reject) => {
      api.once('error', reject);
      api.listen(4198, '127.0.0.1', resolve);
    });
    for (const port of [4198, 8091]) {
      adb('reverse', '--no-rebind', `tcp:${port}`, `tcp:${port}`);
      reversed.push(port);
    }
    metro = spawn(
      process.execPath,
      [
        require.resolve('expo/bin/cli'),
        'start',
        '--dev-client',
        '--localhost',
        '--port',
        '8091',
        '--max-workers',
        '1',
      ],
      {
        env: createMetroEnv(process.env, 4198),
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    metro.stdout.pipe(log, { end: false });
    metro.stderr.pipe(log, { end: false });
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (metro.exitCode !== null) throw new Error('Metro terminó.');
      try {
        ready = (
          await (
            await fetch('http://127.0.0.1:8091/status', { signal: AbortSignal.timeout(1000) })
          ).text()
        ).includes('running');
      } catch {
        /* wait */
      }
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!ready) throw new Error('Metro no está listo.');
    const devUrl =
      'exp+cemydi-mobile://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8091&disableOnboarding=1&disableFab=1&disableAutoLaunch=1';
    const slug = require('../app.json').expo.slug;
    const launchUrl = devUrl.replace('exp+cemydi-mobile:', `exp+${slug}:`);
    fs.mkdirSync('.tools', { recursive: true });
    fs.writeFileSync('.tools/runtime-final-current.json', JSON.stringify({ output, launchUrl }));
    console.log(JSON.stringify({ output, launchUrl, ready: true }));
    // The calling agent launches only CEMYDI through this local URL and runs
    // staged Maestro phases. Keep API state alive across process restarts.
    while (!fs.existsSync(path.join(output, 'STOP')))
      await new Promise((resolve) => setTimeout(resolve, 1000));
  } finally {
    if (metro?.pid && metro.exitCode === null) {
      if (process.platform === 'win32')
        execFileSync('taskkill', ['/PID', String(metro.pid), '/T', '/F']);
      else metro.kill('SIGTERM');
    }
    api.closeAllConnections();
    await new Promise((resolve) => api.close(resolve));
    for (const port of reversed.reverse()) adb('reverse', '--remove', `tcp:${port}`);
    log.end();
    fs.writeFileSync(
      path.join(output, 'server-summary.json'),
      JSON.stringify(
        { unexpected, requestCount: events.length, stoppedAt: new Date().toISOString() },
        null,
        2,
      ),
    );
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
