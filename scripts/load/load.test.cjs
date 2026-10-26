/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const dns = require('node:dns');
const { readFile, rm } = require('node:fs/promises');
const path = require('node:path');
const { setTimeout: sleep } = require('node:timers/promises');
const { PHASES, LIMITS, PATHS, assertRequest } = require('./protocol.cjs');
const { percentile, summarize } = require('./metrics.cjs');
const { createLocalSession } = require('./local-session.cjs');
const { createFixtureApi } = require('../maestro-api.cjs');
const { runProfile } = require('./runner.cjs');
const { createEvidenceDirectory, metadata, writeReports } = require('./reports.cjs');
const { main } = require('./cli.cjs');

const phase = (total = 8, concurrency = 4) => ({
  name: 'test',
  total,
  concurrency,
  rate: concurrency,
});
const success = (durationMs = 10) => ({ kind: 'success', status: 200, bytes: 1, durationMs });

function simulation(options = {}, respond = () => success()) {
  let clock = 0;
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  let closed = false;
  const result = runProfile({
    now: () => clock,
    wait: async (ms) => {
      clock += ms;
    },
    createSession: async () => ({
      request: async (request) => {
        calls++;
        active++;
        maxActive = Math.max(maxActive, active);
        const outcome = await respond(request, calls, () => clock);
        active--;
        return outcome;
      },
      close: async () => {
        closed = true;
      },
    }),
    ...options,
  });
  return { result, state: () => ({ calls, active, maxActive, closed }) };
}

test('protocolo fijo: 180 solicitudes y máximos de 4, sin argumentos CLI', async () => {
  assert.equal(
    PHASES.reduce((sum, item) => sum + item.total, 0),
    180,
  );
  assert.deepEqual(
    PHASES.map((item) => [item.total, item.concurrency, item.rate]),
    [
      [10, 1, 1],
      [30, 1, 1],
      [40, 2, 2],
      [80, 4, 4],
      [20, 2, 2],
    ],
  );
  assert.equal(LIMITS.durationMs, 180_000);
  await assert.rejects(main(['https://example.invalid']), /no acepta argumentos/);
});

test('percentiles interpolados, valores vacíos y métricas terminales', () => {
  assert.equal(percentile([], 0.95), null);
  assert.equal(percentile([30, 10, 40, 20], 0.5), 25);
  assert.equal(percentile([30, 10, 40, 20], 0.95), 38.5);
  assert.equal(percentile([12], 0.95), 12);
  const records = [
    success(10),
    { kind: 'http', status: 503, durationMs: 20 },
    { kind: 'timeout', durationMs: 2000 },
    { kind: 'transport', durationMs: 5 },
  ].map((record, id) => ({ ...record, id, expected: id < 3, offsetMs: id * 1000 }));
  const result = summarize(phase(4), records, 4000, 2, true);
  assert.equal(result.started, 4);
  assert.equal(result.completed, 4);
  assert.equal(result.successful, 1);
  assert.equal(result.responsesConsumed, 2);
  assert.equal(result.httpErrors, 1);
  assert.equal(result.timeouts, 1);
  assert.equal(result.transportFailures, 1);
  assert.equal(result.expectedErrors, 2);
  assert.equal(result.unexpectedErrors, 1);
  assert.equal(result.requestsPerSecond, 1);
});

test('scheduler: respeta concurrencia, ritmo y lotes sin cola (reloj simulado)', async () => {
  for (const concurrency of [1, 2, 4]) {
    const run = simulation({ phases: [phase(9, concurrency)] });
    const result = await run.result;
    assert.equal(result.status, 'passed');
    assert.equal(result.maxConcurrency, concurrency);
    assert.equal(run.state().maxActive, concurrency);
    assert.equal(run.state().active, 0);
    assert.equal(run.state().calls, 9);
    assert.equal(run.state().closed, true);
    for (let index = concurrency; index < result.requests.length; index++) {
      assert.ok(
        result.requests[index].offsetMs - result.requests[index - concurrency].offsetMs >= 1000,
      );
    }
  }
});

test('perfil completo simulado: contabilidad, fallos exactos y recuperación dentro de 180', async () => {
  const run = simulation({}, (request) =>
    request.fault === 'http503'
      ? { kind: 'http', status: 503, bytes: 1, durationMs: 1 }
      : request.fault === 'timeout'
        ? { kind: 'timeout', status: null, bytes: 0, durationMs: 2000 }
        : success(request.delayMs || 1),
  );
  const result = await run.result;
  assert.equal(result.status, 'passed');
  assert.equal(result.started, 180);
  assert.equal(result.completed, 180);
  assert.equal(run.state().calls, 180);
  assert.deepEqual(
    result.phases.map((item) => item.completed),
    [10, 30, 40, 80, 20],
  );
  const faults = result.phases.at(-1);
  assert.equal(faults.httpErrors, 2);
  assert.equal(faults.timeouts, 2);
  assert.equal(faults.expectedErrors, 4);
  assert.equal(faults.unexpectedErrors, 0);
  assert.equal(faults.criteria.recovery, true);
  assert.equal(result.requests.at(-1).recovery, true);
  assert.equal(result.requests.at(-1).id, 180);
  assert.equal(result.requests.at(-1).path, '/promotions');
  // The one-second spacing also applies at phase boundaries.
  assert.ok(result.requests[10].offsetMs - result.requests[9].offsetMs >= 1000);
});

test('scheduler: espera el lote completo y vuelve a esperar si el timer despierta antes', async () => {
  let resolveBatch;
  let calls = 0;
  let clock = 0;
  let waits = 0;
  const run = simulation(
    {
      phases: [phase(4, 2)],
      now: () => clock,
      wait: async (ms) => {
        clock += ++waits === 1 ? ms - 1 : ms;
      },
    },
    async () => {
      calls++;
      if (calls <= 2)
        await new Promise((resolve) => {
          const prior = resolveBatch;
          resolveBatch = () => {
            prior?.();
            resolve();
          };
        });
      return success();
    },
  );
  await sleep(5);
  assert.equal(calls, 2);
  resolveBatch();
  const result = await run.result;
  assert.equal(calls, 4);
  assert.equal(waits, 2);
  assert.equal(result.requests[2].offsetMs, 1000);
});

test('límites: solicitudes, duración y concurrencia/configuración inválida', async () => {
  const count = await simulation({ phases: [phase(5, 1)], limits: { ...LIMITS, requests: 3 } })
    .result;
  assert.equal(count.started, 3);
  assert.equal(count.reason, 'GLOBAL_REQUEST_LIMIT');
  assert.equal(count.status, 'incomplete');
  const duration = await simulation({
    phases: [phase(5, 1)],
    limits: { ...LIMITS, durationMs: 1500 },
  }).result;
  assert.equal(duration.started, 2);
  assert.equal(duration.reason, 'GLOBAL_DURATION_LIMIT');
  const invalid = await simulation({ phases: [phase(5, 5)] }).result;
  assert.equal(invalid.started, 0);
  assert.equal(invalid.reason, 'INVALID_LIMITS');
  for (const limits of [
    { ...LIMITS, requests: 181 },
    { ...LIMITS, concurrency: 5 },
    { ...LIMITS, durationMs: 180001 },
  ]) {
    assert.equal((await simulation({ limits }).result).reason, 'INVALID_LIMITS');
  }
});

test('detiene tres respuestas normales lentas; p95 de 500 ms no aprueba', async () => {
  const slow = await simulation({ phases: [phase(8, 1)] }, () => success(1001)).result;
  assert.equal(slow.started, 3);
  assert.equal(slow.reason, 'THREE_SLOW_NORMAL_RESPONSES');
  assert.equal(slow.status, 'incomplete');
  const failed = await simulation({ phases: [phase(2, 1)] }, () => success(500)).result;
  assert.equal(failed.status, 'failed');
  assert.equal(failed.phases[0].criteria.latency, false);
});

test('errores inesperados, fallos mal programados y fallo de inicio nunca aprueban', async () => {
  for (const outcome of [
    { kind: 'transport' },
    { kind: 'redirect' },
    { kind: 'http', status: 503 },
    { kind: 'timeout' },
  ]) {
    const result = await simulation({ phases: [phase(3, 1)] }, () => ({ ...success(), ...outcome }))
      .result;
    assert.equal(result.status, 'incomplete');
    assert.equal(result.started, 1);
    assert.equal(result.phases[0].unexpectedErrors, 1);
  }
  const wrongFault = await simulation({ phases: [{ ...phase(20, 1), name: 'faults' }] }).result;
  assert.equal(wrongFault.status, 'incomplete');
  const startup = await runProfile({
    createSession: async () => {
      throw new Error('synthetic');
    },
  });
  assert.equal(startup.status, 'incomplete');
  assert.equal(startup.started, 0);
  assert.equal(startup.phases.length, 5);
});

test('HTTP real aislado: rutas del fixture, sin DNS, destinos externos ni credenciales', async (t) => {
  const seen = [];
  const original = http.request;
  // Node resolves the numeric bind address internally; spy after listen() so that
  // this assertion covers outbound requests only (none need DNS).
  const session = await createLocalSession();
  t.after(() => session.close());
  t.mock.method(dns, 'lookup', () => {
    throw new Error('DNS prohibido');
  });
  t.mock.method(http, 'request', (options, ...rest) => {
    seen.push(options);
    assert.equal(options.host, '127.0.0.1');
    assert.equal(options.family, 4);
    assert.equal(options.method, 'GET');
    assert.equal(options.agent, false);
    assert.deepEqual(Object.keys(options.headers), ['x-cemydi-load-id']);
    return original(options, ...rest);
  });
  for (const route of PATHS) {
    const result = await session.request({ path: route });
    assert.equal(result.kind, 'success');
    assert.ok(result.bytes > 0);
  }
  assert.equal(seen.length, PATHS.length);
  assert.ok(seen.every((options) => options.port === session.port));
});

test('HTTP real: ocho solicitudes respetan lotes, concurrencia y ventanas de ritmo', async () => {
  let active = 0;
  let maxActive = 0;
  let received = 0;
  const result = await runProfile({
    phases: [phase(8, 4)],
    createSession: (options) =>
      createLocalSession({
        ...options,
        fixtureFactory: () =>
          http.createServer((req, res) => {
            received++;
            active++;
            maxActive = Math.max(maxActive, active);
            const timer = setTimeout(() => res.end('{}'), 40);
            res.on('close', () => {
              clearTimeout(timer);
              active--;
            });
          }),
      }),
  });
  assert.equal(result.status, 'passed');
  assert.equal(received, 8);
  assert.equal(maxActive, 4);
  assert.equal(active, 0);
  assert.equal(result.phases[0].criteria.rate, true);
  assert.ok(result.requests[4].offsetMs - result.requests[3].offsetMs >= 1000);
});

test('métodos, rutas y URLs ajenos son rechazados antes de abrir conexiones', async (t) => {
  const critical = [];
  const session = await createLocalSession({ onCritical: (code) => critical.push(code) });
  t.after(() => session.close());
  const connect = t.mock.method(http, 'request', () => {
    throw new Error('no debe conectar');
  });
  for (const route of [
    'https://example.invalid/products',
    '//example.invalid/products',
    '/auth',
    '/products/999',
    '/products?search=personal',
    '/promotions?x=1',
  ]) {
    assert.throws(() => session.request({ path: route }), /UNPLANNED_REQUEST/);
  }
  for (const method of ['POST', 'HEAD', 'DELETE', 'PUT']) {
    assert.throws(() => session.request({ path: PATHS[0], method }), /UNPLANNED_REQUEST/);
  }
  assert.equal(connect.mock.callCount(), 0);
  assert.equal(critical.length, 10);
  assert.throws(() => assertRequest('GET', '/products/1#fragment'), /UNPLANNED_REQUEST/);
});

test('HTTP real: exactamente dos 503 y dos timeouts de 2000 ms; luego retardo y recuperación', async (t) => {
  const session = await createLocalSession();
  t.after(() => session.close());
  const run = (fault) => session.request({ path: '/promotions', fault });
  const errors = await Promise.all([run('http503'), run('http503')]);
  assert.ok(errors.every((result) => result.kind === 'http' && result.status === 503));
  const timeouts = await Promise.all([run('timeout'), run('timeout')]);
  assert.ok(
    timeouts.every(
      (result) => result.kind === 'timeout' && result.durationMs >= 1950 && result.status === null,
    ),
  );
  const recovery = await session.request({ path: '/promotions', delayMs: 200 });
  assert.equal(recovery.kind, 'success');
  assert.ok(recovery.durationMs >= 190);
});

test('latencia incluye el consumo completo del body; timeout también cubre body incompleto', async (t) => {
  let timer;
  const session = await createLocalSession({
    fixtureFactory: () =>
      http.createServer((req, res) => {
        res.writeHead(200);
        res.write('{');
        timer = setTimeout(() => res.end('}'), 100);
      }),
  });
  t.after(async () => {
    clearTimeout(timer);
    await session.close();
  });
  const result = await session.request({ path: '/promotions' });
  assert.equal(result.kind, 'success');
  assert.equal(result.bytes, 2);
  assert.ok(result.durationMs >= 90);
  const timeout = await session.request({ path: '/promotions', timeoutMs: 30 });
  assert.equal(timeout.kind, 'timeout');
  assert.equal(timeout.status, 200);
});

test('redirección se rechaza sin seguir Location ni iniciar otra conexión', async (t) => {
  let calls = 0;
  const session = await createLocalSession({
    fixtureFactory: () =>
      http.createServer((req, res) => {
        calls++;
        res.writeHead(302, { Location: 'https://example.invalid/private' });
        res.end();
      }),
  });
  t.after(() => session.close());
  const result = await runProfile({ phases: [phase(4, 1)], createSession: async () => session });
  assert.equal(result.status, 'incomplete');
  assert.equal(result.reason, 'REDIRECT');
  assert.equal(calls, 1);
});

test('cancelación manual aborta solicitudes activas y conserva reportes parciales', async () => {
  const controller = new AbortController();
  let observed;
  const result = await runProfile({
    phases: [phase(8, 2)],
    signal: controller.signal,
    createSession: async (options) => {
      const session = await createLocalSession(options);
      return {
        ...session,
        request: (request) => {
          observed = session.request({ ...request, fault: 'timeout' });
          setTimeout(() => controller.abort(), 30);
          return observed;
        },
      };
    },
  });
  assert.equal(result.status, 'incomplete');
  assert.equal(result.reason, 'MANUAL_INTERRUPTION');
  assert.equal(result.started, 2);
  assert.equal(result.completed, 2);
  assert.ok(result.requests.every((record) => record.kind === 'cancelled'));
  assert.ok(result.durationMs < 1500);
});

test('cancelación mientras espera ritmo no inicia otro lote', async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30);
  try {
    const result = await runProfile({ phases: [phase(3, 1)], signal: controller.signal });
    assert.equal(result.started, 1);
    assert.equal(result.reason, 'MANUAL_INTERRUPTION');
    assert.equal(result.phases[0].status, 'incomplete');
    assert.ok(result.phases[0].durationMs >= 20);
  } finally {
    clearTimeout(timer);
  }
});

test('deadline global aborta un socket pendiente; servidor caído causa parada', async () => {
  const deadline = await runProfile({
    phases: [phase(2, 1)],
    limits: { ...LIMITS, durationMs: 50 },
    createSession: async (options) => {
      const session = await createLocalSession(options);
      return {
        ...session,
        request: (request) => session.request({ ...request, fault: 'timeout' }),
      };
    },
  });
  assert.equal(deadline.reason, 'GLOBAL_DURATION_LIMIT');
  assert.equal(deadline.requests[0].kind, 'cancelled');
  const crashed = await runProfile({
    phases: [phase(3, 1)],
    createSession: (options) =>
      createLocalSession({
        ...options,
        fixtureFactory: () => http.createServer((req) => req.socket.destroy()),
      }),
  });
  assert.equal(crashed.status, 'incomplete');
  assert.equal(crashed.started, 1);
  assert.equal(crashed.phases[0].transportFailures, 1);
  assert.equal(crashed.completed, crashed.started);
});

test('interrupción previa no crea servidor; excepción del handler aborta y no aprueba', async () => {
  const controller = new AbortController();
  controller.abort();
  const run = simulation({ signal: controller.signal });
  const result = await run.result;
  assert.equal(result.started, 0);
  assert.equal(result.reason, 'MANUAL_INTERRUPTION');
  assert.equal(run.state().closed, false);
  const failure = await runProfile({
    phases: [phase(2, 1)],
    createSession: (options) =>
      createLocalSession({
        ...options,
        fixtureFactory: () =>
          http.createServer(() => {
            throw new Error('synthetic');
          }),
      }),
  });
  assert.equal(failure.reason, 'SERVER_HANDLER_ERROR');
  assert.equal(failure.status, 'incomplete');
  assert.equal(failure.started, 1);
});

test('sesión cerrada impide conectar a un puerto distinto/reutilizado', async () => {
  const events = [];
  const session = await createLocalSession({ onCritical: (code) => events.push(code) });
  await session.close();
  assert.throws(() => session.request({ path: '/promotions' }), /DESTINATION_VIOLATION/);
  assert.deepEqual(events, ['DESTINATION_VIOLATION']);
});

test('fixture Maestro conserva su handler y comportamiento sin inyección de fallos', async (t) => {
  const rejected = [];
  const server = createFixtureApi((item) => rejected.push(item));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  const get = (route) =>
    new Promise((resolve, reject) => {
      const request = http.request(
        {
          host: '127.0.0.1',
          port: server.address().port,
          path: route,
          method: 'GET',
          agent: false,
        },
        (response) => {
          let data = '';
          response.on('data', (chunk) => {
            data += chunk;
          });
          response.on('end', () =>
            resolve({ status: response.statusCode, body: JSON.parse(data) }),
          );
        },
      );
      request.on('error', reject);
      request.end();
    });
  for (const route of PATHS) assert.equal((await get(route)).status, 200);
  const products = await get(PATHS[0]);
  assert.deepEqual(
    products.body.products.map((item) => item.id),
    [1, 2],
  );
  assert.equal(rejected.length, 0);
  assert.deepEqual((await get('/promotions')).body, { promotions: [] });
});

test('reportes completos y parciales: cuatro archivos sin bodies, historial independiente', async (t) => {
  const root = path.resolve(__dirname, '../../test-results/load-unit');
  const first = await createEvidenceDirectory(root);
  const second = await createEvidenceDirectory(root);
  assert.equal(path.dirname(first), root);
  assert.equal(path.dirname(second), root);
  t.after(() =>
    Promise.all(
      [first, second].map((directory) => rm(directory, { recursive: true, force: true })),
    ),
  );
  assert.notEqual(first, second);
  const result = await simulation({ phases: [phase(5, 1)], limits: { ...LIMITS, requests: 2 } })
    .result;
  await writeReports(first, result, metadata());
  const saved = JSON.parse(await readFile(path.join(first, 'results.json'), 'utf8'));
  const report = await readFile(path.join(first, 'summary.md'), 'utf8');
  const csv = await readFile(path.join(first, 'requests.csv'), 'utf8');
  const info = JSON.parse(await readFile(path.join(first, 'metadata.json'), 'utf8'));
  assert.equal(saved.status, 'incomplete');
  assert.match(report, /\*\*incomplete\*\*/);
  assert.equal(csv.trim().split('\n').length, 3);
  assert.equal(info.configuration.retries, 0);
  assert.equal(info.configuration.timeoutMs, 2000);
  assert.ok(info.sources['../maestro-api.cjs']);
  assert.ok(!csv.includes('body'));
  const complete = await simulation({ phases: [phase(2, 1)] }).result;
  await writeReports(second, complete, info);
  assert.match(await readFile(path.join(second, 'summary.md'), 'utf8'), /\*\*passed\*\*/);
});
