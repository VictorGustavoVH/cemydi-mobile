const { spawn, spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { mkdirSync, readFileSync, writeFileSync, appendFileSync, rmSync } = require('node:fs');
const path = require('node:path');
const { checkZap } = require('./policy.cjs');
const tools = require('./tools.json');

const root = path.dirname(require.resolve('../../package.json'));
const output = path.join(root, 'test-results/security/dast-smoke');

function createSmokeFixture() {
  return createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (
      !['GET', 'HEAD'].includes(request.method) ||
      request.headers.authorization ||
      request.headers.cookie
    ) {
      response.writeHead(405);
      return response.end(JSON.stringify({ error: 'Solo lectura pública de fixture.' }));
    }
    const url = new URL(request.url, tools.fixtureTarget);
    if (url.pathname === '/') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      return response.end(
        '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Fixture DAST: no es el backend CEMYDI</title></head><body><a href="/health">Health</a><a href="/fixture">Datos sintéticos</a></body></html>',
      );
    }
    if (url.pathname === '/health')
      return response.end(JSON.stringify({ fixture: 'cemydi-security-smoke', backend: false }));
    if (url.pathname === '/fixture')
      return response.end(JSON.stringify({ items: [{ id: 'synthetic', name: 'Solo fixture' }] }));
    response.writeHead(404);
    response.end(JSON.stringify({ error: 'Ruta de fixture inexistente.' }));
  });
}

function contextXml() {
  return '<?xml version="1.0" encoding="UTF-8"?><configuration><context><name>cemydi-fixture-only</name><desc>No evalúa NestJS</desc><inscope>true</inscope><incregexes>^http://127\\.0\\.0\\.1:4199/(?:|health|fixture|robots\\.txt|sitemap\\.xml)$</incregexes></context></configuration>';
}

function baselineArgs(
  directory,
  name,
  identity = { uid: process.getuid?.(), gid: process.getgid?.() },
) {
  if (![identity.uid, identity.gid].every(Number.isInteger))
    throw new Error('Docker smoke requiere identidad Linux explícita.');
  return [
    'run',
    '--rm',
    '--name',
    name,
    '--network',
    'host',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--user',
    `${identity.uid}:${identity.gid}`,
    '--env',
    'HOME=/zap/wrk',
    '--workdir',
    '/zap/wrk',
    '--mount',
    `type=bind,source=${directory},target=/zap/wrk`,
    tools.zapImage,
    'zap-baseline.py',
    '-t',
    tools.fixtureTarget,
    '--autooff',
    '-n',
    'fixture.context',
    '-m',
    '1',
    '-T',
    '3',
    '-D',
    '10',
    '-r',
    'zap.html',
    '-J',
    'zap.json',
    '-z',
    '-silent -dir /zap/wrk/zap-home -config spider.maxDepth=2 -config spider.maxChildren=10 -config spider.maxDuration=1',
  ];
}

async function main() {
  mkdirSync(output, { recursive: true });
  for (const name of ['zap.json', 'zap.html', 'zap.log', 'policy.json', 'fixture.context'])
    rmSync(path.join(output, name), { force: true });
  if (process.argv.length !== 2)
    throw new Error('DAST smoke no acepta URLs ni argumentos externos.');
  if (process.platform !== 'linux')
    throw new Error('DAST smoke requiere Docker Linux; no se ha ejecutado ZAP.');
  const docker = spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], {
    encoding: 'utf8',
    timeout: 30_000,
  });
  if (docker.error || docker.status !== 0)
    throw new Error('Docker no está disponible; DAST no se considera aprobado.');
  const fixture = createSmokeFixture();
  const target = new URL(tools.fixtureTarget);
  const name = `cemydi-security-${randomUUID()}`;
  try {
    fixture.listen(Number(target.port), target.hostname);
    await once(fixture, 'listening');
    const ready = await fetch(new URL('health', tools.fixtureTarget), {
      redirect: 'error',
      signal: AbortSignal.timeout(5_000),
    });
    if (!ready.ok || (await ready.json()).fixture !== 'cemydi-security-smoke')
      throw new Error('No se verificó el fixture propio.');
    writeFileSync(path.join(output, 'fixture.context'), contextXml());
    const args = baselineArgs(output, name);
    const code = await new Promise((resolve, reject) => {
      const child = spawn('docker', args, { cwd: root, timeout: 8 * 60_000 });
      child.stdout.on('data', (data) => appendFileSync(path.join(output, 'zap.log'), data));
      child.stderr.on('data', (data) => appendFileSync(path.join(output, 'zap.log'), data));
      child.on('error', reject);
      child.on('close', (exitCode) => resolve(exitCode));
    });
    if (![0, 1, 2].includes(code))
      throw new Error(
        'ZAP Baseline no completó el escaneo: salida ' + code + '. Consultar zap.log.',
      );
    const report = checkZap(JSON.parse(readFileSync(path.join(output, 'zap.json'), 'utf8')), code);
    report.revision = {
      checkout: process.env.GITHUB_SHA ?? null,
      head: process.env.SECURITY_HEAD_SHA ?? null,
      runId: process.env.GITHUB_RUN_ID ?? null,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    };
    if (!readFileSync(path.join(output, 'zap.html'), 'utf8').includes('<html'))
      throw new Error('Falta el reporte HTML de ZAP.');
    writeFileSync(path.join(output, 'policy.json'), JSON.stringify(report, null, 2));
    const summary = `DAST smoke de infraestructura: ${report.passed ? 'aprobado' : 'fallo'}. Solo fixture. DAST del backend CEMYDI: PENDIENTE.\n`;
    console.log(summary);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
    return report.passed ? 0 : 1;
  } finally {
    // El nombre aleatorio pertenece exclusivamente al contenedor de esta ejecución.
    spawnSync('docker', ['rm', '-f', name], { timeout: 30_000, stdio: 'ignore' });
    fixture.closeAllConnections();
    if (fixture.listening) await new Promise((resolve) => fixture.close(resolve));
  }
}

if (require.main === module) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      mkdirSync(output, { recursive: true });
      writeFileSync(
        path.join(output, 'policy.json'),
        JSON.stringify(
          {
            passed: false,
            scope: 'fixture-only-not-cemydi-backend',
            error: error.message,
            backendDast: 'pending-authorized-isolated-backend',
          },
          null,
          2,
        ),
      );
      console.error(error.message);
      process.exitCode = 2;
    });
}

module.exports = { createSmokeFixture, baselineArgs, contextXml };
