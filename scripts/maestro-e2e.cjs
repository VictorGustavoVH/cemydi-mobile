const { spawn, spawnSync } = require('node:child_process');
const { createServer } = require('node:http');
const { createWriteStream, mkdirSync } = require('node:fs');
const path = require('node:path');
const { expo } = require('../app.json');

const metroPort = 8091;
const apiPort = 4198;
const appId = expo.android.package;
const scheme = Array.isArray(expo.scheme) ? expo.scheme[0] : expo.scheme;
const adb = (args) => {
  const result = spawnSync('adb', args, { encoding: 'utf8' });
  if (result.error || result.status !== 0)
    throw new Error(result.error?.message || result.stderr || 'Falló ADB.');
  return result.stdout.trim();
};

// Public fixtures only: this runner never connects to a developer's backend.
const products = [1, 2].map((id) => ({
  id,
  slug: `equipo-e2e-${id}`,
  nombre: `Equipo E2E ${id}`,
  marca: 'CEMYDI E2E',
  modelo: `Modelo ${id}`,
  descripcion: 'Equipo de prueba para el catálogo público.',
  clasificacion: 'Movilidad',
  precio: 1200,
  stock: id === 1 ? 3 : 0,
  activo: true,
  tipoAdquisicion: 'MIXTO',
  requiereReceta: false,
  rentalDailyPrice: 60,
  rentalMinDays: 3,
  rentalDeposit: 300,
  rentalTerms: 'Condiciones de prueba.',
  medidas: null,
  pesoSoportado: null,
  material: null,
  contenidoCaja: null,
  indicacionesUso: null,
  imageUrl: null,
  images: [],
  createdAt: '2026-10-01T12:00:00.000Z',
}));

const api = createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Cache-Control', 'no-store');
  const send = (body, status = 200) => {
    response.statusCode = status;
    response.end(JSON.stringify(body));
  };
  if (request.method !== 'GET') return send({ message: 'Solo lecturas públicas E2E.' }, 405);
  const url = new URL(request.url, `http://127.0.0.1:${apiPort}`);
  if (url.pathname === '/promotions') return send({ promotions: [] });
  if (url.pathname === '/products') {
    const search = (url.searchParams.get('search') || '').toLowerCase();
    const filtered = products.filter(
      (product) =>
        product.nombre.toLowerCase().includes(search) &&
        (url.searchParams.get('soloDisponibles') !== 'true' || product.stock > 0),
    );
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const pageSize = Math.max(1, Number(url.searchParams.get('pageSize')) || 24);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    return send({
      products: filtered.slice((page - 1) * pageSize, page * pageSize),
      filters: { clasificaciones: ['Movilidad'], marcas: ['CEMYDI E2E'] },
      pagination: {
        page,
        pageSize,
        total: filtered.length,
        totalPages,
        hasPrevious: page > 1,
        hasNext: page < totalPages,
      },
    });
  }
  if (/^\/products\/\d+\/recommendations$/.test(url.pathname)) return send({ recommendations: [] });
  if (/^\/reviews\/product\/\d+$/.test(url.pathname))
    return send({ reviews: [], summary: { count: 0, averageRating: 0 } });
  const id = url.pathname.match(/^\/products\/(\d+)$/)?.[1];
  const product = products.find((item) => item.id === Number(id));
  return product ? send({ product }) : send({ message: 'Recurso E2E no encontrado.' }, 404);
});

async function main() {
  const devices = adb(['devices'])
    .split(/\r?\n/)
    .map((line) => line.match(/^(emulator-\d+)\s+device$/)?.[1])
    .filter(Boolean);
  const serial = process.env.CEMYDI_E2E_DEVICE || devices[0];
  if (!serial) throw new Error('Inicia un emulador Android o configura CEMYDI_E2E_DEVICE.');
  if (!adb(['-s', serial, 'shell', 'pm', 'path', appId]).startsWith('package:'))
    throw new Error(`Instala el development build de ${appId} con npm run android antes de E2E.`);

  let metro;
  const reversed = [];
  mkdirSync('.tools', { recursive: true });
  mkdirSync('test-results/maestro', { recursive: true });
  const log = createWriteStream('.tools/maestro-metro.log');
  try {
    const portProbe = createServer();
    await new Promise((resolve, reject) => {
      portProbe.once('error', reject);
      portProbe.listen(metroPort, '127.0.0.1', () => portProbe.close(resolve));
    });
    await new Promise((resolve, reject) => {
      api.once('error', reject);
      api.listen(apiPort, '127.0.0.1', resolve);
    });
    for (const port of [metroPort, apiPort]) {
      adb(['-s', serial, 'reverse', '--no-rebind', `tcp:${port}`, `tcp:${port}`]);
      reversed.push(port);
    }
    metro = spawn(
      process.execPath,
      [
        '--dns-result-order=ipv4first',
        require.resolve('expo/bin/cli'),
        'start',
        '--dev-client',
        '--localhost',
        '--port',
        String(metroPort),
      ],
      {
        env: {
          ...process.env,
          CI: '1',
          EXPO_NO_DOTENV: '1',
          EXPO_PUBLIC_APP_ENV: 'development',
          EXPO_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}`,
          EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '',
          EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
      },
    );
    metro.stdout.pipe(log, { end: false });
    metro.stderr.pipe(log, { end: false });
    let ready = false;
    console.log(`Preparando Metro E2E y API pública aislada para ${serial}...`);
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline && metro.exitCode === null) {
      try {
        const status = await fetch(`http://127.0.0.1:${metroPort}/status`, {
          signal: AbortSignal.timeout(2000),
        });
        if ((await status.text()).includes('packager-status:running')) {
          ready = true;
          break;
        }
      } catch {
        // Wait for this runner's Metro without reusing an unrelated server.
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!ready) throw new Error('Metro E2E no arrancó. Revisa .tools/maestro-metro.log.');
    const devClientUrl = `exp+${expo.slug}://expo-development-client/?url=${encodeURIComponent(`http://127.0.0.1:${metroPort}`)}`;
    const runner = spawn(
      process.execPath,
      [
        path.resolve('scripts/maestro.cjs'),
        '--device',
        serial,
        'test',
        '--format',
        'junit',
        '--output',
        path.resolve('test-results/maestro/results.xml'),
        '-e',
        `APP_ID=${appId}`,
        '-e',
        `APP_SCHEME=${scheme}`,
        '-e',
        `DEV_CLIENT_URL=${devClientUrl}`,
        '.maestro',
        ...process.argv.slice(2),
      ],
      { stdio: 'inherit' },
    );
    process.exitCode = await new Promise((resolve, reject) => {
      runner.once('error', reject);
      runner.once('exit', (code) => resolve(code ?? 1));
    });
  } finally {
    if (metro?.pid && metro.exitCode === null) {
      if (process.platform === 'win32')
        spawnSync('taskkill', ['/PID', String(metro.pid), '/T', '/F'], { stdio: 'ignore' });
      else process.kill(-metro.pid, 'SIGTERM');
    }
    log.end();
    api.close();
    for (const port of reversed) adb(['-s', serial, 'reverse', '--remove', `tcp:${port}`]);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
