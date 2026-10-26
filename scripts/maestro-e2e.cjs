const { spawn, spawnSync } = require('node:child_process');
const { createServer } = require('node:net');
const { createWriteStream, mkdirSync, writeFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const { expo } = require('../app.json');
const { createFixtureApi } = require('./maestro-api.cjs');
const { checkFlows } = require('./maestro-check.cjs');

function adb(args) {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const candidate =
    sdk && path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  const executable =
    process.env.CEMYDI_ADB || (candidate && existsSync(candidate) ? candidate : 'adb');
  const result = spawnSync(executable, args, { encoding: 'utf8', timeout: 15000 });
  if (result.error || result.status !== 0)
    throw new Error(result.error?.message || result.stderr || 'Falló ADB.');
  return result.stdout.trim();
}
function portNumber(name, fallback) {
  const value = process.env[name] || String(fallback);
  if (!/^\d+$/.test(value) || Number(value) < 1024 || Number(value) > 65535)
    throw new Error(`${name} debe ser un puerto entre 1024 y 65535.`);
  return Number(value);
}
function stopTree(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    const result = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      encoding: 'utf8',
    });
    if (result.error || result.status !== 0)
      throw new Error(`No se pudo detener el proceso ${child.pid}.`);
  } else process.kill(-child.pid, 'SIGTERM');
}
async function main() {
  process.chdir(path.dirname(require.resolve('../package.json')));
  const flows = checkFlows();
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--check') {
    console.log(`YAML y rutas válidos: ${flows.join(', ')}. Sin ejecución Android.`);
    return;
  }
  let target = '.maestro';
  if (args.length) {
    if (args.length !== 2 || args[0] !== '--flow' || !flows.includes(args[1]))
      throw new Error(
        'Uso: npm run test:e2e -- [--check | --flow catalog.yaml]. No se admiten overrides del entorno Maestro.',
      );
    target = path.join('.maestro', args[1]);
  }
  const appId = expo.android.package;
  if (appId !== 'com.cemydi.app') throw new Error('Identificador Android inesperado.');
  const metroPort = portNumber('CEMYDI_E2E_METRO_PORT', 8091);
  const apiPort = portNumber('CEMYDI_E2E_API_PORT', 4198);
  if (metroPort === apiPort) throw new Error('Metro y API necesitan puertos distintos.');
  const serial = process.env.CEMYDI_E2E_DEVICE;
  const devices = adb(['devices'])
    .split(/\r?\n/)
    .map((line) => line.match(/^(\S+)\s+device$/)?.[1])
    .filter(Boolean);
  if (!serial || !devices.includes(serial))
    throw new Error(
      'Selecciona un dispositivo ADB autorizado y conectado con CEMYDI_E2E_DEVICE. Consulta adb devices -l.',
    );
  console.log(`Dispositivo seleccionado: ${serial}; app: ${appId}.`);
  if (!adb(['-s', serial, 'shell', 'pm', 'path', appId]).startsWith('package:'))
    throw new Error(
      `No está instalado ${appId}. Prepara un Development Build; no se generará ni descargará automáticamente.`,
    );
  // SDK 57 supports test-only launch flags: keep Expo's onboarding and FAB
  // from intercepting taps on the application's own onboarding controls.
  const devClientUrl = `exp+${expo.slug}://expo-development-client/?url=${encodeURIComponent(`http://127.0.0.1:${metroPort}`)}&disableOnboarding=1&disableFab=1&disableAutoLaunch=1`;
  const resolved = adb([
    '-s',
    serial,
    'shell',
    'cmd',
    'package',
    'resolve-activity',
    '--brief',
    '-a',
    'android.intent.action.VIEW',
    '-c',
    'android.intent.category.BROWSABLE',
    '-d',
    `'${devClientUrl}'`,
    appId,
  ]);
  const info = adb(['-s', serial, 'shell', 'dumpsys', 'package', appId]);
  if (
    !resolved.includes(`${appId}/`) ||
    !/\bDEBUGGABLE\b/.test(info) ||
    !info.includes('expo.modules.devlauncher')
  )
    throw new Error(
      'La app instalada no se reconoce como Development Build debuggable con Expo Dev Launcher. Un APK Preview no basta.',
    );
  if (process.env.CEMYDI_E2E_ALLOW_CLEAR !== serial)
    throw new Error(
      `Los flujos borran TODOS los datos de ${appId} en ${serial}. Tras identificar el dispositivo y autorizar esa limpieza, configura CEMYDI_E2E_ALLOW_CLEAR con ese serial. No se ha abierto ni borrado la app.`,
    );
  const cli = path.resolve('scripts/maestro.cjs');
  const help = spawnSync(process.execPath, [cli, 'test', '--help'], {
    encoding: 'utf8',
    timeout: 30000,
  });
  if (
    help.error ||
    help.status !== 0 ||
    !help.stdout.includes('--test-output-dir') ||
    !help.stdout.includes('--debug-output')
  )
    throw new Error(
      'Maestro no está disponible o no soporta los flags de evidencias. Ejecuta npm run maestro -- test --help.',
    );
  const started = new Date();
  const output = path.resolve('test-results/maestro', started.toISOString().replace(/[:.]/g, '-'));
  mkdirSync(output, { recursive: true });
  const log = createWriteStream(path.join(output, 'metro.log'));
  const maestroLog = createWriteStream(path.join(output, 'maestro-console.log'));
  const unexpected = [];
  const api = createFixtureApi((request) => {
    unexpected.push(request);
    console.error(`API E2E rechazó ${request.method} ${request.path} (${request.status}).`);
  });
  let metro;
  let runner;
  let interrupted = false;
  let failure;
  let code = 1;
  const reversed = [];
  const onSignal = () => {
    interrupted = true;
    for (const child of [runner, metro]) {
      try {
        stopTree(child);
      } catch (error) {
        console.error(error.message);
      }
    }
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  try {
    const probe = createServer();
    await new Promise((resolve, reject) => {
      probe.once('error', reject);
      probe.listen(metroPort, '127.0.0.1', () => probe.close(resolve));
    });
    await new Promise((resolve, reject) => {
      api.once('error', reject);
      api.listen(apiPort, '127.0.0.1', resolve);
    });
    for (const port of [metroPort, apiPort]) {
      if (interrupted) throw new Error('Ejecución interrumpida.');
      adb(['-s', serial, 'reverse', '--no-rebind', `tcp:${port}`, `tcp:${port}`]);
      reversed.push(port);
    }
    // Never load .env or inherit public values from a developer's shell.
    const childEnv = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => !key.startsWith('EXPO_') && key !== 'REACT_NATIVE_PACKAGER_HOSTNAME',
      ),
    );
    Object.assign(childEnv, {
      CI: '1',
      NODE_ENV: 'development',
      EXPO_NO_DOTENV: '1',
      EXPO_OFFLINE: '1',
      EXPO_NO_TELEMETRY: '1',
      EXPO_PUBLIC_APP_ENV: 'development',
      EXPO_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}`,
      EXPO_PUBLIC_WEBSITE_URL: `http://127.0.0.1:${apiPort}`,
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '',
      EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '',
    });
    metro = spawn(
      process.execPath,
      [
        '--dns-result-order=ipv4first',
        require.resolve('expo/bin/cli'),
        'start',
        '--dev-client',
        '--localhost',
        '--clear',
        '--port',
        String(metroPort),
      ],
      {
        env: childEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
      },
    );
    metro.stdout.pipe(log, { end: false });
    metro.stderr.pipe(log, { end: false });
    let metroError;
    metro.once('error', (error) => {
      metroError = error;
    });
    let ready = false;
    console.log(`Metro ${metroPort}; API ficticia ${apiPort}; evidencias: ${output}`);
    const deadline = Date.now() + 120_000;
    while (!interrupted && !metroError && Date.now() < deadline && metro.exitCode === null) {
      try {
        const status = await fetch(`http://127.0.0.1:${metroPort}/status`, {
          signal: AbortSignal.timeout(2000),
        });
        if ((await status.text()).includes('packager-status:running')) {
          ready = true;
          break;
        }
      } catch {
        /* Wait only for this runner's Metro. */
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!ready || interrupted)
      throw new Error(
        metroError?.message || 'Metro E2E no arrancó o se interrumpió. Revisa metro.log.',
      );
    runner = spawn(
      process.execPath,
      [
        cli,
        '--device',
        serial,
        'test',
        '--format',
        'junit',
        '--output',
        path.join(output, 'results.xml'),
        '--debug-output',
        output,
        '--test-output-dir',
        output,
        '-e',
        `APP_ID=${appId}`,
        '-e',
        `DEV_CLIENT_URL=${devClientUrl}`,
        target,
      ],
      {
        env: childEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
      },
    );
    runner.stdout.pipe(process.stdout);
    runner.stderr.pipe(process.stderr);
    runner.stdout.pipe(maestroLog, { end: false });
    runner.stderr.pipe(maestroLog, { end: false });
    code = await new Promise((resolve, reject) => {
      runner.once('error', reject);
      runner.once('close', (status) => resolve(status ?? 1));
    });
    if (unexpected.length || interrupted) code = 1;
  } catch (error) {
    failure = error.message;
    code = 1;
  } finally {
    // Attempt every cleanup even when another operation fails.
    for (const child of [runner, metro]) {
      try {
        if (child?.pid && child.exitCode === null && child.signalCode === null) {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(
              () => reject(new Error(`El proceso ${child.pid} no terminó.`)),
              10000,
            );
            child.once('close', () => {
              clearTimeout(timeout);
              resolve();
            });
            try {
              stopTree(child);
            } catch (error) {
              clearTimeout(timeout);
              reject(error);
            }
          });
        }
      } catch (error) {
        failure = error.message;
        code = 1;
      }
    }
    api.closeAllConnections();
    await new Promise((resolve) => api.close(resolve));
    for (const port of reversed.reverse()) {
      try {
        adb(['-s', serial, 'reverse', '--remove', `tcp:${port}`]);
      } catch (error) {
        failure = error.message;
        code = 1;
      }
    }
    metro?.stdout?.unpipe(log);
    metro?.stderr?.unpipe(log);
    runner?.stdout?.unpipe(maestroLog);
    runner?.stderr?.unpipe(maestroLog);
    await Promise.all(
      [log, maestroLog].map((stream) => new Promise((resolve) => stream.end(resolve))),
    );
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    writeFileSync(
      path.join(output, 'run.json'),
      JSON.stringify(
        {
          appId,
          serial,
          target,
          startedAt: started.toISOString(),
          durationMs: Date.now() - started.getTime(),
          exitCode: code,
          interrupted,
          unexpected,
          failure,
        },
        null,
        2,
      ),
    );
  }
  if (failure) console.error(failure);
  process.exitCode = code;
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
