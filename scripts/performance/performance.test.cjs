const { test } = require('node:test');
const { Buffer } = require('node:buffer');
const assert = require('node:assert/strict');
const { readFileSync, mkdtempSync, writeFileSync, unlinkSync, rmdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const m = require('./metrics.cjs');
const {
  options,
  bounded,
  conditions,
  offline,
  captureConfig,
  capture,
  main,
} = require('./cli.cjs');
const { inspect } = require('./inspect-gfxinfo.cjs');
const { analyzeCpu } = require('./trace-cpu.cjs');
const { selectLayer, latency, presentationSummary } = require('./presentation.cjs');
const {
  graphicsScript,
  parseGraphicsStream,
  startGraphicsStream,
  afterBaseline,
} = require('./graphics-stream.cjs');

test('flujo gráfico acota muestras al recorrido, ignora salida parcial y no conserva texto crudo', () => {
  const sample = (start, end, value) =>
    `CEMYDI_GFX_BEGIN ${start}\n${value}\nCEMYDI_GFX_END ${end}\n`;
  const text =
    sample('1.00', '1.10', 'before') +
    sample('2.00', '2.10', 'valid') +
    sample('3.90', '4.10', 'after') +
    'CEMYDI_GFX_BEGIN 3.00\npartial';
  assert.deepEqual(
    parseGraphicsStream(text, '2', '4', () => ({ redacted: true })),
    [{ redacted: true, deviceStartSeconds: 2, deviceEndSeconds: 2.1 }],
  );
  assert.throws(() => graphicsScript(0));
  assert.match(graphicsScript(35), /sleep 0\.01/);
  assert.match(graphicsScript(35), /dumpsys gfxinfo com\.cemydi\.app framestats/);
  assert.doesNotMatch(graphicsScript(35), /reset|am start|input |rm /);
});

test('flujo gráfico usa proceso independiente y timeout con entrada fija, sin Android', async () => {
  let options;
  const result = await startGraphicsStream(
    'synthetic',
    35,
    new AbortController().signal,
    (file, args, config, callback) => {
      options = config;
      assert.deepEqual(args, ['-s', 'synthetic', 'shell', '-T', 'sh']);
      return {
        stdin: {
          on() {},
          end(text) {
            assert.equal(text, graphicsScript(35) + '\n');
            callback(null, 'synthetic');
          },
        },
      };
    },
  );
  assert.equal(result.status, 'captured');
  assert.equal(options.timeout, 50000);
  assert.equal(options.windowsHide, true);
});

const presented = (...times) =>
  latency(`16666667\n${times.map((time) => `${time} ${time} ${time}`).join('\n')}`);

test('presentación selecciona únicamente una capa exacta y rechaza entradas de shell', () => {
  const layer = 'com.cemydi.app/com.cemydi.app.MainActivity#0';
  assert.equal(selectLayer(`other\n${layer}`), layer);
  assert.equal(selectLayer(`${layer}\n${layer.replace('#0', '#1')}`), null);
  assert.equal(selectLayer(`${layer};id`), null);
  assert.equal(selectLayer(`SurfaceView - ${layer}`), null);
  assert.equal(selectLayer('other'), null);
});

test('FPS usa presentaciones únicas nuevas y su ventana real, excluyendo baseline y reposo final', () => {
  const result = presentationSummary(
    [
      presented(1000000000),
      presented(1000000000, 2000000000, 2500000000),
      presented(2000000000, 2500000000, 3000000000),
      presented(2000000000, 2500000000, 3000000000),
    ],
    true,
  );
  assert.equal(result.status, 'measured');
  assert.equal(result.value.frames, 3);
  assert.equal(result.value.windowSeconds, 1);
  assert.equal(result.value.averageFps, 2);
});

test('FPS no se inventa con pérdida de buffer, capa cambiada, reposo o fences pendientes', () => {
  assert.equal(presentationSummary([presented(1), presented(2, 3)], true).status, 'No medible');
  assert.equal(presentationSummary([presented(1), presented(1, 2, 3)], false).status, 'No medible');
  assert.equal(presentationSummary([presented(1), presented(1)], true).status, 'No medible');
  assert.equal(presentationSummary([presented(1), presented(1, 2)], true).status, 'No medible');
  const pending = latency('16666667\n1 1 1\n2 2 2\n3 3 3\n4 9223372036854775807 4');
  assert.equal(presentationSummary([presented(1), pending], true).status, 'No medible');
  assert.equal(presentationSummary([presented(1, 2), presented(1)], true).status, 'No medible');
});

test('latencia rechaza formatos, timestamps y órdenes inválidos', () => {
  for (const text of [
    'denied',
    '0\n',
    '16666667\ninvalid',
    '16666667\n1 0 1',
    '16666667\n1 2 1\n2 1 2',
  ])
    assert.equal(latency(text).status, 'No medible');
  assert.deepEqual(latency('16666667\n0 0 0').value.frames, []);
});

test('FPS distingue el fence real de los campos desired y ready pendientes', () => {
  const snapshot = latency('16666667\n1 1 9223372036854775807\n9223372036854775807 2 2');
  assert.equal(snapshot.status, 'measured');
  assert.equal(snapshot.value.pending, false);
  assert.deepEqual(snapshot.value.frames, [1, 2]);
  const pending = latency('16666667\n3 9223372036854775807 3');
  assert.equal(pending.value.records[0].key, 'desired:3');
  assert.equal(pending.value.records[0].actualPresentNs, null);
});

test('FPS resuelve solo identidades del recorrido sin incorporar frames de estabilización', () => {
  const pending = latency(
    '16666667\n1 1 1\n2000000000 2000000000 2000000000\n3000000000 9223372036854775807 3000000000',
  );
  const samples = [presented(1), pending];
  assert.equal(presentationSummary(samples, true).status, 'No medible');
  const result = presentationSummary(samples, true, [
    presented(1, 2000000000, 3000000000, 9000000000),
  ]);
  assert.equal(result.status, 'measured');
  assert.equal(result.value.frames, 2);
  assert.equal(result.value.windowSeconds, 1);
  assert.equal(result.value.averageFps, 1);
  const lost = presentationSummary(samples, true, [presented(9000000000)]);
  assert.equal(lost.status, 'No medible');
});

test('FPS excluye un fence del baseline aunque se resuelva durante el recorrido', () => {
  const baseline = latency('16666667\n1 1 1\n2 9223372036854775807 2');
  const result = presentationSummary([baseline, presented(1, 2, 1000000000, 2000000000)], true);
  assert.equal(result.status, 'measured');
  assert.equal(result.value.frames, 2);
  assert.equal(result.value.averageFps, 1);
});

test('FPS rechaza cambios de identidad, pérdida intermedia y pendientes históricos sin identidad', () => {
  const pending = latency('16666667\n1 1 1\n2 9223372036854775807 2');
  assert.equal(
    presentationSummary([presented(1), pending, presented(1, 3, 4)], true).status,
    'No medible',
  );
  const changed = latency('16666667\n1 1 1\n2 5 2\n3 6 3');
  assert.equal(
    presentationSummary([presented(1), presented(1, 2, 3)], true, [changed]).status,
    'No medible',
  );
  const legacy = { status: 'measured', value: { refreshNs: 16666667, frames: [1], pending: true } };
  assert.equal(presentationSummary([legacy, presented(1, 2, 3)], true).status, 'No medible');
});

function protoField(id, value) {
  const varint = (number) => {
    let remaining = BigInt(number);
    const bytes = [];
    while (remaining >= 128n) {
      bytes.push(Number(remaining & 127n) | 128);
      remaining >>= 7n;
    }
    return Buffer.from([...bytes, Number(remaining)]);
  };
  if (Buffer.isBuffer(value))
    return Buffer.concat([varint(id * 8 + 2), varint(value.length), value]);
  return Buffer.concat([varint(id * 8), varint(value)]);
}

function cpuTraceFixture({
  unknownThread = false,
  gap = false,
  overwritten = 0,
  newThread = false,
  forkChild = false,
  exitEarly = false,
  resumeAfterExit = false,
  kernelLoss = false,
  missingKernel = false,
} = {}) {
  const message = (...fields) => Buffer.concat(fields);
  const packet = (value) => protoField(1, value);
  const process = (pid, name) =>
    protoField(1, message(protoField(1, pid), protoField(3, Buffer.from(name))));
  const tree = packet(
    protoField(
      2,
      message(
        process(10, 'com.cemydi.app'),
        process(20, 'other'),
        protoField(2, message(protoField(1, 11), protoField(3, 10))),
      ),
    ),
  );
  const event = (seconds, previous, next) =>
    protoField(
      2,
      message(
        protoField(1, BigInt(Math.round(seconds * 1e9))),
        protoField(4, message(protoField(2, previous), protoField(6, next))),
      ),
    );
  const cpu0 = packet(
    protoField(
      1,
      message(protoField(1, 0), event(1, 0, 10), event(3, gap ? 99 : 10, 20), event(5, 20, 0)),
    ),
  );
  const thread = unknownThread || newThread || forkChild ? 99 : 11;
  const lifecycle = [];
  if (newThread || forkChild)
    lifecycle.push(
      protoField(
        2,
        message(
          protoField(1, 500000000n),
          protoField(2, 10),
          protoField(235, message(protoField(1, thread), protoField(3, newThread ? 65536 : 0))),
        ),
      ),
    );
  if (exitEarly)
    lifecycle.push(
      protoField(
        2,
        message(
          protoField(1, 3500000000n),
          protoField(2, thread),
          protoField(238, protoField(2, thread)),
        ),
      ),
    );
  const cpu1 = packet(
    protoField(
      1,
      message(
        protoField(1, 1),
        ...lifecycle,
        event(1, 0, thread),
        ...(resumeAfterExit ? [event(3.6, thread, 20), event(3.8, 20, thread)] : []),
        event(5, thread, 0),
      ),
    ),
  );
  const statsStart = packet(protoField(35, protoField(1, protoField(13, 0))));
  const statsEnd = packet(protoField(35, protoField(1, protoField(13, overwritten))));
  const kernelStats = (phase) =>
    packet(
      protoField(
        34,
        message(
          protoField(1, phase),
          ...[0, 1].map((cpu) =>
            protoField(
              2,
              message(protoField(1, cpu), protoField(3, kernelLoss && phase === 2 ? 1 : 0)),
            ),
          ),
        ),
      ),
    );
  return message(
    tree,
    cpu0,
    cpu1,
    statsStart,
    statsEnd,
    ...(missingKernel ? [] : [kernelStats(1), kernelStats(2)]),
  );
}

test('CPU sched recorta límites, suma hilos y CPUs, y declara escala de un núcleo', () => {
  const result = analyzeCpu(cpuTraceFixture(), 10, '2', '4');
  assert.equal(result.process.status, 'measured');
  assert.equal(result.process.value.cpuMilliseconds, 3000);
  assert.equal(result.process.value.mainThreadCpuMilliseconds, 1000);
  assert.equal(result.process.value.percentOfOneCpu, 150);
  assert.equal(result.diagnostics.attributedThreads, 2);
});
test('CPU sched no aprueba pérdida, TID desconocidos, PID incorrecto ni huecos', () => {
  for (const options of [
    { unknownThread: true },
    { gap: true },
    { overwritten: 1 },
    { kernelLoss: true },
    { missingKernel: true },
  ])
    assert.equal(analyzeCpu(cpuTraceFixture(options), 10, '2', '4').process.status, 'No medible');
  assert.equal(analyzeCpu(cpuTraceFixture(), 99, '2', '4').process.status, 'No medible');
  assert.equal(analyzeCpu(cpuTraceFixture(), 10, '0', '4').process.status, 'No medible');
  assert.equal(analyzeCpu(Buffer.from('invalid'), 10, '2', '4').process.status, 'No medible');
});
test('CPU distingue hilos CLONE_THREAD de procesos hijo mediante ciclo de vida', () => {
  const exiting = analyzeCpu(cpuTraceFixture({ exitEarly: true }), 10, '2', '4');
  assert.equal(exiting.process.status, 'measured');
  assert.equal(exiting.process.value.percentOfOneCpu, 150);
  assert.equal(exiting.diagnostics.lifecycleExits, 1);
  const thread = analyzeCpu(cpuTraceFixture({ newThread: true }), 10, '2', '4');
  assert.equal(thread.process.status, 'measured');
  assert.equal(thread.process.value.percentOfOneCpu, 150);
  assert.equal(thread.diagnostics.lifecycleBirths, 1);
  const child = analyzeCpu(cpuTraceFixture({ forkChild: true }), 10, '2', '4');
  assert.equal(child.process.status, 'measured');
  assert.equal(child.process.value.percentOfOneCpu, 50);
});
test('CPU incluye ejecución y reanudaciones después de sched_process_exit', () => {
  const result = analyzeCpu(
    cpuTraceFixture({ exitEarly: true, resumeAfterExit: true }),
    10,
    '2',
    '4',
  );
  assert.equal(result.process.status, 'measured');
  assert.ok(Math.abs(result.process.value.cpuMilliseconds - 2800) < 1e-6);
  assert.ok(Math.abs(result.process.value.percentOfOneCpu - 140) < 1e-6);
});

test('pérdida distingue baseline antiguo, incremento nuevo, reset y ausencia de estadísticas', () => {
  const { checkLoss } = require('./trace-loss.cjs');
  const kernel = { start: new Map([[0, [7, 0, 0]]]), end: new Map([[0, [7, 0, 0]]]) };
  const zero = [0, 0, 0, 0, 0, 0, 0, 0];
  assert.equal(checkLoss([zero, zero], kernel, [0]).verified, true);
  const initial = [...zero];
  initial[0] = 4;
  const unchanged = checkLoss([initial, initial], kernel, [0]);
  assert.equal(unchanged.serviceIncreased, false);
  assert.equal(unchanged.serviceInitialNonzero, true);
  assert.equal(unchanged.verified, true);
  const sessionLoss = [...zero];
  sessionLoss[3] = 1;
  assert.equal(checkLoss([sessionLoss, sessionLoss], kernel, [0]).verified, false);
  assert.equal(checkLoss([zero, initial], kernel, [0]).serviceIncreased, true);
  assert.equal(checkLoss([initial, zero], kernel, [0]).verified, false);
  assert.equal(checkLoss([zero], kernel, [0]).verified, false);
  assert.equal(checkLoss([zero, zero], kernel, [0, 1]).verified, false);
});
const {
  cpuWindow,
  traceArgs,
  traceConfig,
  inspectTrace,
  routeCoverage,
  validTrace,
  startTrace,
} = require('./native-trace.cjs');

test('diagnóstico de validación conserva etapa y contadores sin texto del dispositivo', async () => {
  assert.equal(inspectTrace(Buffer.from([10, 1, 7])).stage, 'packet');
  assert.equal(inspectTrace(Buffer.alloc(0)).valid, false);
  assert.equal(inspectTrace(traceFixture).events, 1);
  assert.equal(inspectTrace(traceFixture).valid, true);
  assert.deepEqual(options(['trace-check', '--device', 'synthetic', '--authorize', 'synthetic']), {
    command: 'trace-check',
    device: 'synthetic',
    authorize: 'synthetic',
  });
  await assert.rejects(main(['trace-check', '--device', 'synthetic']), /authorize/);
});

test('CPU rechaza ventanas antiguas, cruzadas y sin límites verificables', () => {
  const text =
    'CPU usage from 5000ms to 1000ms ago (private):\n  12.5% 123/com.cemydi.app: 10% user + 2.5% kernel';
  assert.equal(cpuWindow(text, 123, 6000).value.percent, 12.5);
  assert.equal(cpuWindow(text, 123, 5000).status, 'measured');
  for (const elapsed of [undefined, NaN, -1, 500, 4999])
    assert.equal(cpuWindow(text, 123, elapsed).status, 'No medible');
  for (const value of ['', text.replace('5000ms', '500ms'), text + '\n  1% 124/com.cemydi.app: x'])
    assert.equal(cpuWindow(value, 123, 6000).status, 'No medible');
  assert.equal(cpuWindow(text, 124, 6000).status, 'No medible');
  assert.equal(cpuWindow(text, null, 6000).status, 'No medible');
  assert.equal(cpuWindow(text.replace('12.5%', '0%'), 123, 6000).value.percent, 0);
  assert.doesNotMatch(JSON.stringify(cpuWindow(text, 123, 6000)), /private/);
});
const remoteFixture = '/data/misc/perfetto-traces/cemydi-abcd.perfetto-trace';
const traceFixture = Buffer.from([10, 8, 10, 6, 18, 4, 8, 1, 26, 0]);
test('Perfetto rechaza ayuda, texto, protobuf truncado y ausencia de eventos', () => {
  assert.equal(validTrace(traceFixture), true);
  const crlfAltered = Buffer.from(
    [...traceFixture].flatMap((byte) => (byte === 10 ? [13, 10] : [byte])),
  );
  assert.equal(validTrace(crlfAltered), false);
  for (const data of [
    Buffer.alloc(0),
    Buffer.from('perfetto: invalid option -- a\nUsage: perfetto'),
    Buffer.from('{}'),
    traceFixture.subarray(0, 8),
    Buffer.from([10, 2, 8, 1]),
    Buffer.from([10, 1, 7]),
  ])
    assert.equal(validTrace(data), false);
  assert.doesNotMatch(traceArgs('synthetic', 40, remoteFixture).join(' '), / -a /);
  assert.match(traceArgs('synthetic', 40, remoteFixture).join(' '), /--txt -c -/);
  assert.deepEqual(traceArgs('synthetic', 40, remoteFixture).slice(0, 5), [
    '-s',
    'synthetic',
    'shell',
    '-T',
    'perfetto',
  ]);
  assert.match(traceConfig(40), /duration_ms: 40000/);
  assert.match(traceConfig(40), /write_into_file: true/);
  assert.match(traceConfig(40), /file_write_period_ms: 1000/);
  assert.match(traceConfig(40), /max_file_size_bytes: 134217728/);
  assert.match(traceConfig(40), /atrace_apps: "com.cemydi.app"/);
  assert.match(traceConfig(40), /task\/task_newtask/);
  assert.match(traceConfig(40), /sched\/sched_process_exit/);
  assert.match(traceConfig(40), /record_thread_names: true/);
  assert.match(traceConfig(40), /target_buffer: 1/);
  assert.match(traceConfig(40), /buffers \{ size_kb: 4096/);
  assert.match(traceConfig(40), /clear_period_ms: 5000/);
  assert.match(traceConfig(40), /proc_stats_poll_ms: 1000/);
  assert.match(traceConfig(40), /proc_stats_cache_ttl_ms: 1000/);
  assert.throws(() => traceArgs('bad serial', 40, remoteFixture));
  assert.throws(() => traceArgs('synthetic', 0, remoteFixture));
  assert.throws(() => traceArgs('synthetic', 40, '/arbitrary/path'));
});
function fakeTraceProcess(data, error = null, elapsedMs = 40000) {
  let clock = 0;
  let remoteFile;
  return {
    now: () => clock,
    run(executable, args, config, callback) {
      assert.equal(config.encoding, 'buffer');
      assert.equal(config.windowsHide, true);
      if (args[2] === 'exec-out') {
        assert.deepEqual(args, ['-s', 'synthetic', 'exec-out', 'cat', remoteFile]);
        assert.equal(config.timeout, 60000);
        assert.equal(config.maxBuffer, 160 * 1024 * 1024);
        queueMicrotask(() => callback(null, data));
        return {};
      }
      remoteFile = args[6];
      assert.deepEqual(args, traceArgs('synthetic', 40, remoteFile));
      assert.equal(config.timeout, 65000);
      return {
        stdin: {
          on() {},
          end(input) {
            assert.equal(input, traceConfig(40));
            clock = elapsedMs;
            queueMicrotask(() => callback(error, Buffer.from('recording log\r\n')));
          },
        },
      };
    },
  };
}

test('traza guarda solo binario válido, rechaza salida inmediata y conserva evidencia exclusiva', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cemydi-native-test-'));
  const signal = new AbortController().signal;
  const captureFake = (rep, data, error, elapsedMs) => {
    const fake = fakeTraceProcess(data, error, elapsedMs);
    return startTrace('synthetic', 40, dir, rep, signal, fake.run, fake.now);
  };
  try {
    const result = await captureFake(1, traceFixture);
    assert.equal(result.status, 'captured');
    assert.equal(result.analysis.startsWith('pending'), true);
    assert.equal(result.sha256.length, 64);
    const processFailure = await captureFake(2, traceFixture, new Error('private error'));
    assert.equal(processFailure.status, 'failed');
    assert.equal(processFailure.diagnostics.processError, true);
    assert.equal(processFailure.diagnostics.transferAttempted, false);
    assert.doesNotMatch(JSON.stringify(processFailure), /private error/);
    assert.equal(
      (await captureFake(3, Buffer.from('perfetto: invalid option -- a'))).status,
      'failed',
    );
    assert.equal((await captureFake(4, traceFixture, null, 500)).status, 'failed');
    const timeout = await captureFake(
      5,
      Buffer.alloc(0),
      Object.assign(new Error('private timeout'), { killed: true }),
      65000,
    );
    assert.equal(timeout.diagnostics.timedOut, true);
    assert.match(timeout.reason, /Timeout/);
    assert.equal((await captureFake(1, traceFixture)).status, 'failed');
    assert.deepEqual(readFileSync(path.join(dir, result.file)), traceFixture);
    assert.equal(
      require('node:fs').existsSync(path.join(dir, 'repetition-3.perfetto-trace')),
      false,
    );
  } finally {
    for (const name of [
      'repetition-1.perfetto-trace',
      'repetition-3.unvalidated.bin',
      ...[1, 2, 3, 4, 5].map((i) => `repetition-${i}-trace.json`),
    ])
      unlinkSync(path.join(dir, name));
    rmdirSync(dir);
  }
});

test('cobertura exige inicio y final en cada CPU observada sin relajar pérdida o reloj', () => {
  const report = {
    valid: true,
    lostBundles: 0,
    nonBootClockBundles: 0,
    compactBundles: 0,
    cpuRanges: [
      { cpu: 0, firstSeconds: 1, lastSeconds: 6 },
      { cpu: 1, firstSeconds: 1.5, lastSeconds: 5 },
    ],
  };
  assert.equal(routeCoverage(report, '2', '4').boundsCovered, true);
  assert.equal(routeCoverage(report, '1', '4').status, 'No medible');
  assert.equal(routeCoverage(report, '2', '6').status, 'No medible');
  for (const extra of [
    { lostBundles: 1 },
    { nonBootClockBundles: 1 },
    { compactBundles: 1 },
    { cpuRanges: [] },
    { valid: false },
  ])
    assert.equal(routeCoverage({ ...report, ...extra }, '2', '4').status, 'No medible');
  for (const bounds of [
    [undefined, '4'],
    ['NaN', '4'],
    ['4', '2'],
  ])
    assert.equal(routeCoverage(report, ...bounds).status, 'No medible');
});

test('inspección conserva rangos reales y señal de pérdida ftrace', () => {
  // Trace > packet > bundle(cpu=0, lost_events=1) > event(timestamp=1ns, print).
  const trace = Buffer.from([10, 12, 10, 10, 8, 0, 24, 1, 18, 4, 8, 1, 26, 0]);
  const report = inspectTrace(trace);
  assert.equal(report.valid, true);
  assert.equal(report.lostBundles, 1);
  assert.deepEqual(report.cpuRanges, [{ cpu: 0, firstSeconds: 1e-9, lastSeconds: 1e-9 }]);
});

const gfx = (
  total,
  janky,
  rows = '',
  {
    pid = 123,
    name = 'synthetic-window',
    since = '1',
    globalTotal = total,
    globalJanky = janky,
  } = {},
) =>
  `** Graphics info for pid ${pid} [com.cemydi.app] **\nStats since: 1ns\nTotal frames rendered: ${globalTotal}\nJanky frames: ${globalJanky} (0%)\nProfile data in ms:\nWindow: ${name}\nStats since: ${since}ns\nTotal frames rendered: ${total}\nJanky frames: ${janky} (0%)\n---PROFILEDATA---\nFlags,IntendedVsync,FrameCompleted,\n${rows}\n---PROFILEDATA---\nView hierarchy:\n`;
test('PSS Android 10, App Summary y salidas incompletas', () => {
  assert.equal(m.memory(' TOTAL 4567 0 0 0').value, 4567);
  assert.equal(m.memory(' TOTAL 4567 0\n TOTAL PSS: 4567 TOTAL RSS: 6000').value, 4567);
  for (const value of [
    'No process found for: com.cemydi.app',
    '',
    ' TOTAL NaN 0',
    ' TOTAL -2',
    ' TOTAL 1\n TOTAL 2',
    ' TOTAL 9007199254740992',
  ])
    assert.equal(m.memory(value).status, 'No medible');
  assert.equal(
    m.memory('** MEMINFO in pid 1\n** MEMINFO in pid 2\n TOTAL 10').status,
    'No medible',
  );
});
test('gfxinfo cuenta frames únicos y distingue jank de tiempos', () => {
  const before = m.graphics(gfx(10, 0));
  const after = m.graphics(gfx(12, 1, '0,1000000000,1005000000,\n0,2000000000,2701000000,'));
  const summary = m.frameSummary(before, after, [after, after]);
  assert.equal(summary.value.capturedFrames, 2);
  assert.equal(summary.value.jankPercent, 50);
  assert.equal(summary.value.slowPercent.value, 50);
  assert.equal(summary.value.frozenFrames.value, 1);
});
test('frames anteriores no contaminan el intervalo', () => {
  const before = m.graphics(gfx(1, 0, '0,1000000,2000000,'));
  const after = m.graphics(gfx(2, 0, '0,1000000,2000000,\n0,3000000,4000000,'));
  assert.equal(m.frameSummary(before, after, [after]).value.capturedFrames, 1);
});
test('resumen procesa una sola vez el objeto final compartido e incorpora uno independiente', () => {
  const before = m.graphics(gfx(0, 0));
  const after = m.graphics(gfx(1, 0, '0,1000000,2000000,'));
  const frames = after.frames;
  let reads = 0;
  Object.defineProperty(after, 'frames', {
    get() {
      reads++;
      return frames;
    },
  });
  assert.equal(m.frameSummary(before, after, [after]).value.capturedFrames, 1);
  assert.equal(reads, 1);
  const final = m.graphics(gfx(2, 1, '0,3000000,4000000,'));
  const result = m.frameSummary(before, final, [after]).value;
  assert.equal(result.total, 2);
  assert.equal(result.jankPercent, 50);
  assert.equal(result.capturedFrames, 2);
  assert.equal(result.slowPercent.status, 'measured');
});
test('muestras vacías o ausentes producen No medible con motivo', () => {
  const sample = m.graphics(gfx(1, 0));
  for (const args of [
    [sample, sample, []],
    [sample, undefined, [sample]],
    [sample, null, [sample]],
    [undefined, sample, [sample]],
    [sample, sample, undefined],
    [sample, sample, [undefined]],
  ]) {
    const result = m.frameSummary(...args);
    assert.equal(result.status, 'No medible');
    assert.match(result.reason, /Falta|Sin muestras|ausente/);
  }
});
test('buffers circulares y muestras solapadas conservan cobertura estricta', () => {
  const before = m.graphics(gfx(0, 0));
  const row = (index) => `0,${index * 1000000},${index * 1000000 + 500000},`;
  const first = m.graphics(gfx(3, 1, [1, 2, 3].map(row).join('\n')));
  const overlap = m.graphics(gfx(5, 2, [3, 4, 5].map(row).join('\n')));
  const complete = m.frameSummary(before, overlap, [first, overlap]).value;
  assert.equal(complete.capturedFrames, 5);
  assert.equal(complete.slowPercent.status, 'measured');
  const lost = m.graphics(gfx(9, 3, [7, 8, 9].map(row).join('\n')));
  const partial = m.frameSummary(before, lost, [first, overlap, overlap, lost]).value;
  assert.equal(partial.total, 9);
  assert.equal(partial.capturedFrames, 8);
  assert.equal(partial.slowPercent.status, 'No medible');
  assert.equal(partial.frozenFrames.status, 'No medible');
  const empty = m.graphics(gfx(10, 3));
  const noFrames = m.frameSummary(before, empty, [empty]).value;
  assert.equal(noFrames.capturedFrames, 0);
  assert.equal(noFrames.slowPercent.status, 'No medible');
});
test('flujo continuo recupera cobertura HWUI sin sustituir fórmulas ni umbrales', () => {
  const before = m.graphics(gfx(10, 0));
  const after = m.graphics(gfx(12, 1, '0,30000000,800000000,'));
  assert.equal(m.frameSummary(before, after, [after]).value.slowPercent.status, 'No medible');
  const text = `CEMYDI_GFX_BEGIN 2.00\n${gfx(11, 0, '0,1000000,2000000,')}\nCEMYDI_GFX_END 2.10\n`;
  const samples = parseGraphicsStream(text, '2', '4', m.graphics);
  const result = m.frameSummary(before, after, [...samples, after]);
  assert.equal(result.value.capturedFrames, 2);
  assert.equal(result.value.slowPercent.value, 50);
  assert.equal(result.value.frozenFrames.value, 1);
  assert.equal(result.value.jankPercent, 50);
});

test('buffers parciales, proceso nuevo y contadores inválidos nunca aprueban', () => {
  const before = m.graphics(gfx(10, 0));
  const after = m.graphics(gfx(12, 1, '0,1000000,2000000,'));
  assert.equal(m.frameSummary(before, after, [after]).value.slowPercent.status, 'No medible');
  assert.equal(m.frameSummary(before, { ...after, pid: 124 }, [after]).status, 'No medible');
  assert.equal(m.frameSummary(after, before, [before]).status, 'No medible');
  assert.equal(m.frameSummary(before, before, [before]).status, 'No medible');
  assert.equal(m.frameSummary(before, after, [m.graphics(gfx(2, 0)), after]).status, 'No medible');
  for (const text of [
    '',
    gfx('NaN', 0),
    gfx(1, 2),
    gfx(-1, 0),
    `${gfx(1, 0)}\nTotal frames rendered: 1`,
  ])
    assert.equal(m.graphics(text).counters.status, 'No medible');
});
test('cabeceras cambiadas, flags y timestamps inválidos', () => {
  const report = m.graphics(gfx(4, 0, '1,1,2,\n0,2,1,\n0,NaN,4,\n0,10,9007199254740993,'));
  assert.equal(report.frames.length, 0);
  assert.equal(report.invalidRows, 3);
  assert.equal(m.graphics(gfx(1, 0).replace('FrameCompleted', 'Unknown')).timings, 'No medible');
});

test('HWUI conserva Flags excluidos y distingue faltantes sin aprobar cobertura parcial', () => {
  const before = m.graphics(gfx(10, 0));
  const after = m.graphics(gfx(13, 1, '0,100,200,\n1,300,400,'));
  const result = m.frameSummary(before, after, [after]).value;
  assert.deepEqual(after.excludedFrames, [{ flags: 1, start: 300, end: 400 }]);
  assert.equal(result.coverage.eligibleFrames, 1);
  assert.equal(result.coverage.excludedFrames, 1);
  assert.equal(result.coverage.unaccountedFrames, 1);
  assert.equal(result.slowPercent.status, 'No medible');
  assert.equal(result.frozenFrames.status, 'No medible');
  const repeated = m.frameSummary(before, after, [after, after]).value;
  assert.equal(repeated.coverage.excludedFrames, 1);
  const excludedOnly = m.graphics(gfx(11, 0, '1,300,400,'));
  const covered = m.frameSummary(before, excludedOnly, [excludedOnly]).value;
  assert.equal(covered.coverage.unaccountedFrames, 0);
  assert.equal(covered.slowPercent.status, 'No medible');
});

test('baseline del colector descarta solo el prefijo anterior y conserva resets posteriores', () => {
  const before = m.graphics(gfx(10, 0));
  const earlier = m.graphics(gfx(9, 0));
  const current = m.graphics(gfx(11, 0));
  const laterReset = m.graphics(gfx(2, 0));
  const selected = afterBaseline([earlier, current, laterReset], before);
  assert.deepEqual(selected, [current, laterReset]);
  assert.equal(m.frameSummary(before, laterReset, selected).status, 'No medible');
  const invalid = m.graphics('');
  assert.deepEqual(afterBaseline([invalid, current], before), [invalid, current]);
  assert.deepEqual(afterBaseline([current], invalid), [current]);
});
test('am start solo acepta tiempo válido sin warnings', () => {
  assert.equal(m.launch('Status: ok\nTotalTime: 123\nWaitTime: 140').value, 123);
  for (const text of [
    'Status: ok',
    'Status: timeout\nTotalTime: 1',
    'Status: ok\nTotalTime: NaN',
    'Status: ok\nTotalTime: -1',
    'Warning: delivered\nStatus: ok\nTotalTime: 0',
  ])
    assert.equal(m.launch(text).status, 'No medible');
});
test('retorno al frente conserva diagnóstico pero no inventa un inicio', () => {
  const text =
    'Warning: Activity not started, its current task has been brought to the front\r\nStatus: ok\r\nTotalTime: 0\r\nWaitTime: 45\r\n';
  const info = m.launchDiagnostics(text);
  assert.equal(info.taskBroughtToFront, true);
  assert.equal(info.waitTimeMs, 45);
  assert.equal(info.totalTimeMs, 0);
  assert.equal(info.reportedLaunchState, 'unknown');
  assert.match(m.launch(text).reason, /retorno al primer plano/);
  assert.equal(m.launch('Status: ok\nWaitTime: 45').status, 'No medible');
  assert.equal(m.launch('Status: ok\nTotalTime:\n123').status, 'No medible');
  assert.equal(m.launch('Status: ok\nTotalTime: 1\nTotalTime: 2').status, 'No medible');
});
test('diagnóstico de lanzamiento no conserva intent, URI ni texto privado', () => {
  const text =
    'Starting: Intent { dat=synthetic-private-value }\nWarning: Activity not started, intent has been delivered to currently running top-most instance.\nStatus: ok\nWaitTime: 1';
  assert.equal(m.launchDiagnostics(text).intentDelivered, true);
  assert.doesNotMatch(JSON.stringify(m.launchDiagnostics(text)), /synthetic-private-value/);
  assert.equal(m.launch(text).status, 'No medible');
  assert.equal(m.launch('Status: ok\r\nThisTime: 7\r\nTotalTime: 12\r\nWaitTime: 15').value, 12);
});
test('gfxinfo distingue ausencias, duplicados y números inválidos sin elegir un contador arbitrario', () => {
  const duplicate = m.graphics(
    '** Graphics info for pid 123 [com.cemydi.app] **\nTotal frames rendered: 10\nJanky frames: 1 (10%)\nWindow: synthetic\nTotal frames rendered: 10\nJanky frames: 1 (10%)',
  );
  assert.equal(duplicate.diagnostics.totalMatches, 2);
  assert.deepEqual(duplicate.diagnostics.totalValues, [10, 10]);
  assert.equal(duplicate.counters.status, 'No medible');
  assert.equal(
    m.graphics('Total frames rendered: NaN\nJanky frames: 1 (10%)').diagnostics.totalValues[0],
    null,
  );
  assert.equal(m.graphics('unknown format').diagnostics.totalLabels, 0);
  assert.equal(m.graphics('Total frames rendered:\n12').diagnostics.totalMatches, 0);
  assert.equal(m.graphics(gfx(10, 1).replaceAll('\n', '\r\n')).counters.value.total, 10);
});
test('PID estable con contadores ausentes no se informa como cambio de proceso', () => {
  const sample = m.graphics(
    '** Graphics info for pid 123 [com.cemydi.app] **\nFlags,IntendedVsync,FrameCompleted,\n0,1,2,',
  );
  assert.match(m.frameSummary(sample, sample, [sample]).reason, /contadores iniciales/);
  const valid = m.graphics(gfx(10, 0));
  assert.match(m.frameSummary(valid, valid, [sample]).reason, /contadores gráficos/);
  assert.match(m.frameSummary(valid, valid, [valid]).reason, /Sin frames nuevos/);
});
test('gfxinfo global y ventana: selecciona por estructura sin asumir equivalencia de valores', () => {
  const text =
    '** Graphics info for pid 123 [com.cemydi.app] **\nStats since: 1ns\nTotal frames rendered: 18\nJanky frames: 6 (33%)\nProfile data in ms:\nWindow: synthetic-private-title\nStats since: 1ns\nTotal frames rendered: 18\nJanky frames: 6 (33%)\n---PROFILEDATA---\nFlags,IntendedVsync,FrameCompleted,\n0,1,2,\n---PROFILEDATA---\nView hierarchy:\nsynthetic-private-content';
  const parsed = m.graphics(text);
  const counters = parsed.diagnostics.structure.events.filter((event) =>
    event.kind.endsWith('-counter'),
  );
  assert.deepEqual(
    counters.map((event) => event.region),
    ['process-preamble', 'process-preamble', 'window', 'window'],
  );
  assert.deepEqual(
    counters.map((event) => event.value),
    [18, 6, 18, 6],
  );
  assert.deepEqual(parsed.counters, m.measured({ total: 18, janky: 6 }));
  assert.equal(parsed.source.region, 'window');
  assert.equal(parsed.diagnostics.structure.ownership, 'unverified');
  assert.doesNotMatch(JSON.stringify(parsed.diagnostics), /synthetic-private/);
  assert.deepEqual(m.graphics(text.replaceAll('\n', '\r\n')).diagnostics, parsed.diagnostics);
});
test('varias secciones con contadores diferentes no se suman ni se elige una', () => {
  const parsed = m.graphics(
    gfx(18, 6) +
      '\nWindow: test\nStats since: 2ns\nTotal frames rendered: 19\nJanky frames: 7 (36%)',
  );
  assert.deepEqual(parsed.diagnostics.totalValues, [18, 18, 19]);
  assert.deepEqual(parsed.diagnostics.jankyValues, [6, 6, 7]);
  assert.equal(parsed.counters.status, 'No medible');
  assert.equal(m.frameSummary(parsed, parsed, [parsed]).status, 'No medible');
});
test('duplicados en una sola sección siguen ambiguos aunque sean iguales', () => {
  const parsed = m.graphics(
    '** Graphics info for pid 123 [com.cemydi.app] **\nTotal frames rendered: 18\nJanky frames: 6 (33%)\nTotal frames rendered: 18\nJanky frames: 6 (33%)',
  );
  const events = parsed.diagnostics.structure.events.filter((event) =>
    event.kind.endsWith('-counter'),
  );
  assert.equal(new Set(events.map((event) => event.sectionIndex)).size, 1);
  assert.equal(parsed.counters.status, 'No medible');
});
test('no empareja total y jank de procesos, ventanas o bloques diferentes', () => {
  const prefix = '** Graphics info for pid 123 [com.cemydi.app] **\nTotal frames rendered: 18\n';
  for (const divider of [
    'Window: test',
    '** Graphics info for pid 456 [other] **',
    'Stats since: 2ns',
  ]) {
    assert.equal(
      m.graphics(prefix + divider + '\nJanky frames: 6 (33%)').counters.status,
      'No medible',
    );
  }
});
test('formato desconocido se redacta y no habilita contadores', () => {
  const parsed = m.graphics(
    '** Graphics info for pid 123 [com.cemydi.app] **\nPrivate synthetic header:\nTotal frames rendered: 18\nJanky frames: 6 (33%)',
  );
  assert.equal(parsed.counters.status, 'No medible');
  assert.equal(parsed.diagnostics.structure.events.at(-1).region, 'unknown');
  assert.doesNotMatch(JSON.stringify(parsed.diagnostics), /Private synthetic/);
  assert.equal(m.graphics('unknown format').counters.status, 'No medible');
});
test('fixture con posiciones reales: global 7/8, ventana 51/52 y framestats 66-78', () => {
  // Only reported counter/boundary/header positions and counts are observed.
  // All other context, identity, epoch and frame rows are synthetic, not evidence.
  const lines = Array(78).fill('');
  lines[0] = '** Graphics info for pid 123 [com.cemydi.app] **';
  lines[5] = 'Stats since: 1ns';
  lines[6] = 'Total frames rendered: 20';
  lines[7] = 'Janky frames: 8 (40%)';
  lines[42] = 'Profile data in ms:';
  lines[48] = 'Window: synthetic-window';
  lines[49] = 'Stats since: 2ns';
  lines[50] = 'Total frames rendered: 20';
  lines[51] = 'Janky frames: 8 (40%)';
  lines[65] = '---PROFILEDATA---';
  lines[66] = 'Flags,IntendedVsync,FrameCompleted,';
  for (let index = 67; index < 77; index++) lines[index] = `0,${1000 + index},${2000 + index},`;
  lines[77] = '---PROFILEDATA---';
  const parsed = m.graphics(lines.join('\n'));
  assert.deepEqual(parsed.counters, m.measured({ total: 20, janky: 8 }));
  assert.equal(parsed.source.region, 'window');
  assert.equal(parsed.source.statsBlock, 2);
  assert.equal(parsed.frames.length, 10);
  assert.deepEqual(
    parsed.diagnostics.structure.events
      .filter((event) => event.kind === 'total-counter')
      .map((event) => event.line),
    [7, 51],
  );
});
test('selecciona ventana cuando los globales difieren y nunca usa globales como fallback', () => {
  const selected = m.graphics(gfx(20, 8, '', { globalTotal: 300, globalJanky: 50 }));
  assert.deepEqual(selected.counters.value, { total: 20, janky: 8 });
  const globalOnly =
    '** Graphics info for pid 123 [com.cemydi.app] **\nStats since: 1ns\nTotal frames rendered: 300\nJanky frames: 50 (16%)';
  assert.equal(m.graphics(globalOnly).counters.status, 'No medible');
  const before = m.graphics(gfx(20, 8, '', { globalTotal: 300, globalJanky: 50 }));
  const after = m.graphics(gfx(21, 8, '0,100,200,', { globalTotal: 900, globalJanky: 400 }));
  assert.equal(m.frameSummary(before, after, [after]).value.total, 1);
  assert.equal(m.frameSummary(before, after, [after]).value.janky, 0);
});
test('ventanas múltiples incluso con igual nombre, valor y un solo bloque de frames no se seleccionan', () => {
  for (const name of ['synthetic-window', 'other']) {
    const text = gfx(20, 8).replace(
      'Profile data in ms:',
      `Profile data in ms:\nWindow: ${name}\nStats since: 1ns\nTotal frames rendered: 20\nJanky frames: 8 (40%)`,
    );
    assert.equal(m.graphics(text).counters.status, 'No medible');
  }
});
test('asociación incompleta, desconocida o duplicada no habilita la ventana', () => {
  const valid = gfx(20, 8);
  const mutations = [
    valid.replace('Window: synthetic-window', 'Window:'),
    valid.replace(
      'Window: synthetic-window\nStats since: 1ns',
      'Window: synthetic-window\nStats since: unknown',
    ),
    valid.replace('Window: synthetic-window\nStats since: 1ns', 'Window: synthetic-window'),
    valid.replace('Window: synthetic-window', 'Window: synthetic-window\nOEM unknown:'),
    valid.replace(
      'Window: synthetic-window',
      'Window: synthetic-window\nTotal frames rendered: 20',
    ),
    valid.replace('Window: synthetic-window', 'Window: synthetic-window\nJanky frames: 8 (40%)'),
    valid.replace('---PROFILEDATA---\nView hierarchy:', 'View hierarchy:'),
    valid.replace('Flags,IntendedVsync,FrameCompleted,', ''),
    valid.replace('Profile data in ms:', 'unknown layout:'),
    valid.replace('Window: synthetic-window', 'Window: synthetic-window\nStats since: 2ns'),
  ];
  for (const text of mutations) assert.equal(m.graphics(text).counters.status, 'No medible');
});
test('continuidad exige PID, ventana, bloque, región y época estables', () => {
  const before = m.graphics(gfx(20, 8));
  for (const changed of [
    m.graphics(gfx(21, 8, '', { pid: 456 })),
    m.graphics(gfx(21, 8, '', { name: 'other-window' })),
    m.graphics(gfx(21, 8, '', { since: '2' })),
    m.graphics(gfx(21, 8), 'different-session-key'),
  ])
    assert.equal(m.frameSummary(before, changed, [changed]).status, 'No medible');
  for (const [key, value] of [
    ['region', 'process-preamble'],
    ['statsBlock', 3],
    ['sectionIndex', 9],
  ]) {
    const after = m.graphics(gfx(21, 8));
    after.source[key] = value;
    assert.match(m.frameSummary(before, after, [after]).reason, /continuidad/);
  }
  const after = m.graphics(gfx(21, 8));
  const changed = m.graphics(gfx(20, 8, '', { name: 'other-window' }));
  assert.equal(m.frameSummary(before, after, [changed, after]).status, 'No medible');
});
test('identidad opaca no conserva título privado y las claves separan sesiones', () => {
  const raw = gfx(20, 8, '', { name: 'private-synthetic-window' });
  const first = m.graphics(raw, 'session-A');
  assert.equal(first.source.windowId, m.graphics(raw, 'session-A').source.windowId);
  assert.notEqual(first.source.windowId, m.graphics(raw, 'session-B').source.windowId);
  assert.doesNotMatch(JSON.stringify(first), /private-synthetic-window|session-A/);
});
test('jank sigue medible con cobertura parcial, sin aprobar lentos/congelados', () => {
  const before = m.graphics(gfx(20, 8));
  const after = m.graphics(gfx(25, 9, '0,100,200,'));
  const result = m.frameSummary(before, after, [after]);
  assert.equal(result.value.jankPercent, 20);
  assert.equal(result.value.slowPercent.status, 'No medible');
  assert.equal(result.value.frozenFrames.status, 'No medible');
  const invalid = m.graphics(gfx(21, 8, '0,NaN,200,'));
  assert.equal(m.frameSummary(before, invalid, [invalid]).value.slowPercent.status, 'No medible');
  const invalidBefore = m.graphics(gfx(20, 8, '0,NaN,200,'));
  const completeAfter = m.graphics(gfx(21, 8, '0,100,200,'));
  assert.equal(
    m.frameSummary(invalidBefore, completeAfter, [completeAfter]).value.frozenFrames.status,
    'No medible',
  );
});
test('jank, frames lentos y congelados tienen fuentes y fórmulas diferentes', () => {
  const before = m.graphics(gfx(20, 8));
  const after = m.graphics(gfx(22, 9, '0,1000000000,1020000000,\n0,2000000000,2025000000,'));
  const result = m.frameSummary(before, after, [after]).value;
  assert.equal(result.jankPercent, 50);
  assert.equal(result.slowPercent.value, 100);
  assert.equal(result.frozenFrames.value, 0);
  const old = { ...before };
  delete old.source;
  assert.equal(m.frameSummary(old, after, [after]).status, 'No medible');
});
test('ventana reiniciada o incremento inconsistente no genera porcentajes', () => {
  const before = m.graphics(gfx(20, 8));
  for (const after of [m.graphics(gfx(1, 0)), m.graphics(gfx(21, 10)), m.graphics(gfx(20, 8))])
    assert.equal(m.frameSummary(before, after, [after]).status, 'No medible');
  const after = m.graphics(gfx(25, 10));
  assert.equal(m.frameSummary(before, after, [m.graphics(gfx(1, 0)), after]).status, 'No medible');
});
test('inspección puntual usa solo lectura, salida redactada y aislamiento obligatorio', () => {
  const calls = [];
  const fake = (args) => {
    calls.push(args);
    if (args[0] === 'devices') return 'synthetic device';
    if (args.at(-1) === 'airplane_mode_on') return '1';
    if (args.at(-1) === 'wifi_on') return '0';
    if (args.at(-1) === 'connectivity') return 'Active default network: none';
    assert.deepEqual(args, [
      '-s',
      'synthetic',
      'shell',
      'dumpsys',
      'gfxinfo',
      'com.cemydi.app',
      'framestats',
    ]);
    return (
      gfx(18, 6) + '\nWindow: synthetic-private\nTotal frames rendered: 18\nJanky frames: 6 (33%)'
    );
  };
  const report = inspect('synthetic', fake);
  assert.equal(calls.length, 5);
  assert.equal(report.counters.status, 'No medible');
  assert.doesNotMatch(JSON.stringify(report), /synthetic-private|durationMs|"frames"/);
  let gfxCalls = 0;
  assert.throws(
    () =>
      inspect('synthetic', (args) => {
        if (args.includes('gfxinfo')) gfxCalls++;
        return args[0] === 'devices' ? 'synthetic device' : '0';
      }),
    /Aislamiento/,
  );
  assert.equal(gfxCalls, 0);
  assert.throws(() => inspect('synthetic', () => 'synthetic offline'), /desconectado/);
});
test('detección conservadora de build instalada', () => {
  const release =
    'versionCode=1 minSdk=24\nversionName=1.0.0\nlastUpdateTime=2026-10-25 12:00:00\nflags=[ HAS_CODE ]';
  assert.equal(m.build(release).representative, true);
  assert.equal(m.build(release.replace('HAS_CODE', 'DEBUGGABLE HAS_CODE')).representative, false);
  assert.equal(m.build(`${release}\nexpo.modules.devlauncher`).representative, false);
  assert.equal(m.build('versionCode=1').representative, false);
});
test('dispositivo desconectado, unauthorized, offline y selección explícita', () => {
  assert.equal(m.deviceState('List of devices attached\nabc device model:test', 'abc'), true);
  for (const text of ['', 'abc offline', 'abc unauthorized', 'other device'])
    assert.throws(() => m.deviceState(text, 'abc'));
});
function run(pss = 100) {
  return {
    schemaVersion: 1,
    status: 'captured',
    metadata: {
      device: 'synthetic',
      android: '10',
      sdk: '29',
      model: 'test',
      fingerprint: 'test',
      hardware: 'test',
      abi: 'arm64-v8a',
      memTotalKb: 1000000,
      displaySize: '1080x2340',
      displayDensity: '480',
      appId: 'com.cemydi.app',
      build: { representative: true },
      conditions: { network: 'offline' },
      scenario: 'PERF-02',
      durationSeconds: 60,
      intervalSeconds: 5,
      settleSeconds: 15,
      repeat: 3,
      launch: false,
      protocolVersion: 1,
    },
    repetitions: Array.from({ length: 3 }, () => ({
      status: 'captured',
      observation: 'completed',
      memory: [
        { phase: 'route', pssKb: m.measured(pss) },
        { phase: 'settled', pssKb: m.measured(pss + 10) },
      ],
      graphics: m.measured({
        jankPercent: 1,
        slowPercent: m.measured(2),
        frozenFrames: m.measured(0),
      }),
    })),
  };
}
test('comparaciones reales: medias y delta, sin aprobación global implícita', () => {
  const comparison = m.compare(run(), run(120));
  assert.equal(comparison.deltaPssKb, 20);
  assert.equal(comparison.baselineMeanFinalPssKb, 110);
  assert.equal(comparison.verdict, 'pending');
  assert.equal(
    m.compare(run(), { ...run(), metadata: { device: 'other', repeat: 3 } }).status,
    'not-comparable',
  );
});
test('umbrales estrictos y falta de evidencia', () => {
  const data = run();
  data.repetitions[0].graphics.value.slowPercent = m.measured(10);
  assert.equal(m.objectives(data), 'failed');
  data.repetitions[0].graphics.value.slowPercent = m.unavailable('sin frames');
  assert.equal(m.objectives(data), 'pending');
  data.repetitions[0].graphics.value.frozenFrames = m.measured(1);
  assert.equal(m.objectives(data), 'failed');
  data.repetitions[0].observation = 'crash';
  assert.equal(m.objectives(data), 'failed');
  assert.equal(m.objectives({ repetitions: [] }), 'pending');
});
test('corridas incompletas o números inválidos no son comparables', () => {
  for (const value of [NaN, Infinity, -1]) {
    const data = run(value);
    assert.equal(m.compare(run(), data).status, 'not-comparable');
  }
  const data = run();
  data.repetitions[0].observation = 'skipped';
  assert.equal(m.compare(run(), data).status, 'not-comparable');
  assert.equal(m.compare(run(), { ...run(), repetitions: [] }).status, 'not-comparable');
});
test('opciones estrictas y autorización antes de usar ADB', async () => {
  assert.deepEqual(options(['diagnose', '--device', 'abc']), {
    command: 'diagnose',
    device: 'abc',
  });
  for (const argv of [
    ['capture', '--unknown', 'x'],
    ['capture', '--device'],
    ['diagnose', '--device', 'a', '--device', 'b'],
  ])
    assert.throws(() => options(argv));
  for (const value of ['NaN', '-1', '1.2', '1000']) assert.throws(() => bounded(value, 3, 3, 10));
  await assert.rejects(main(['capture', '--device', 'abc']), /authorize/);
  await assert.rejects(
    main(['screenshot', '--device', 'abc', '--authorize', 'other']),
    /authorize/,
  );
});
test('aislamiento debe verificarse; formato desconocido bloquea', () => {
  const fake = (airplane, wifi, network) => (args) =>
    args.at(-1) === 'airplane_mode_on' ? airplane : args.at(-1) === 'wifi_on' ? wifi : network;
  assert.doesNotThrow(() => offline(fake('1', '0', 'Active default network: none')));
  for (const values of [
    ['0', '0', 'Active default network: none'],
    ['1', '1', 'Active default network: none'],
    ['1', '0', 'Active default network: 100'],
    ['1', '0', 'unknown'],
  ])
    assert.throws(() => offline(fake(...values)));
});
test('condiciones permiten únicamente datos categóricos sin secretos', () => {
  const file = require.resolve('./conditions.example.json');
  assert.equal(conditions(file).session, 'guest');
  assert.throws(() => conditions());
  const dir = mkdtempSync(path.join(tmpdir(), 'cemydi-perf-'));
  const input = path.join(dir, 'conditions.json');
  const base = JSON.parse(readFileSync(file, 'utf8'));
  try {
    for (const data of [
      { ...base, authorization: 'synthetic' },
      { ...base, session: 'real' },
      { ...base, network: 'production' },
      [],
      null,
    ]) {
      writeFileSync(input, JSON.stringify(data));
      assert.throws(() => conditions(input));
    }
    writeFileSync(input, '{invalid synthetic JSON');
    assert.throws(
      () => conditions(input),
      (error) => !error.message.includes('synthetic'),
    );
  } finally {
    unlinkSync(input);
    rmdirSync(dir);
  }
});
test('build development bloquea captura antes de cualquier comando de medición', async () => {
  let calls = 0;
  await assert.rejects(
    capture(
      {},
      () => {
        calls++;
      },
      { build: { representative: false }, qualification: 'Build no apta' },
      '',
    ),
    /Build no apta/,
  );
  assert.equal(calls, 0);
});
test('PERF-01 a PERF-05 conservan configuración y restricciones de lanzamiento', () => {
  const file = require.resolve('./conditions.example.json');
  for (let index = 1; index <= 5; index++) {
    const args = { scenario: `PERF-0${index}`, conditions: file };
    const config = captureConfig(args);
    assert.equal(config.repeat, 3);
    assert.equal(config.duration, 60);
    assert.equal(config.interval, 5);
    assert.equal(config.settle, 15);
    assert.equal(config.config.initialState, 'background');
    if (index === 1) assert.doesNotThrow(() => captureConfig({ ...args, launch: 'yes' }));
    else assert.throws(() => captureConfig({ ...args, launch: 'yes' }), /solo para PERF-01/);
  }
  const repeated = captureConfig({
    scenario: 'PERF-05',
    conditions: file,
    duration: '120',
    settle: '30',
  });
  assert.equal(repeated.duration, 120);
  assert.equal(repeated.settle, 30);
});
test('PERF-06 valida configuración local sin ADB ni respuestas a prompts', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cemydi-perf06-'));
  const file = path.join(dir, 'conditions.json');
  const base = {
    ...conditions(require.resolve('./conditions.example.json')),
    initialState: 'foreground',
  };
  const args = { scenario: 'PERF-06', conditions: file };
  try {
    writeFileSync(file, JSON.stringify(base));
    assert.doesNotThrow(() => captureConfig({ ...args, 'native-trace': 'yes' }));
    assert.throws(() => captureConfig({ ...args, 'native-trace': 'no' }));
    assert.throws(() => captureConfig({ ...args, scenario: 'PERF-02', 'native-trace': 'yes' }));
    const expected = { config: base, repeat: 3, duration: 30, interval: 1, settle: 15 };
    assert.deepEqual(captureConfig(args), expected);
    assert.deepEqual(
      captureConfig({ ...args, repeat: '3', duration: '30', interval: '1', settle: '15' }),
      expected,
    );
    for (const invalid of [
      { launch: 'yes' },
      { launch: 'no' },
      { scenario: 'PERF-07' },
      { scenario: 'toString' },
      { repeat: '2' },
      { duration: 'NaN' },
      { interval: '30', duration: '30' },
      { settle: '0' },
    ])
      assert.throws(() => captureConfig({ ...args, ...invalid }));
    for (const invalid of [
      { initialState: 'background' },
      { initialState: 'not-running' },
      { data: 'synthetic-local' },
      { network: 'online' },
      { session: 'authenticated' },
    ]) {
      writeFileSync(file, JSON.stringify({ ...base, ...invalid }));
      assert.throws(() => captureConfig(args));
    }
  } finally {
    unlinkSync(file);
    rmdirSync(dir);
  }
});
test('comparación exige metadatos completos y punto final estabilizado', () => {
  const data = run();
  delete data.metadata.protocolVersion;
  assert.equal(m.compare(run(), data).status, 'not-comparable');
  const unsettled = run();
  unsettled.repetitions[0].memory.at(-1).phase = 'route';
  assert.equal(m.compare(run(), unsettled).status, 'not-comparable');
});
test('diagnóstico nuevo usa protocolo separado sin reinterpretar capturas históricas', () => {
  const baseline = run();
  const candidate = run();
  candidate.metadata.protocolVersion = 2;
  assert.equal(m.compare(baseline, candidate).status, 'not-comparable');
  baseline.metadata.protocolVersion = 2;
  assert.equal(m.compare(baseline, candidate).status, 'compared');
  candidate.metadata.protocolVersion = 3;
  assert.equal(m.compare(baseline, candidate).status, 'not-comparable');
  baseline.metadata.protocolVersion = 3;
  assert.equal(m.compare(baseline, candidate).status, 'compared');
  candidate.metadata.protocolVersion = 4;
  assert.equal(m.compare(baseline, candidate).status, 'not-comparable');
  baseline.metadata.protocolVersion = 4;
  assert.equal(m.compare(baseline, candidate).status, 'compared');
  candidate.metadata.protocolVersion = 5;
  assert.equal(m.compare(baseline, candidate).status, 'not-comparable');
  baseline.metadata.protocolVersion = 5;
  assert.equal(m.compare(baseline, candidate).status, 'compared');
  candidate.metadata.protocolVersion = 6;
  assert.equal(m.compare(baseline, candidate).status, 'not-comparable');
  baseline.metadata.protocolVersion = 6;
  assert.equal(m.compare(baseline, candidate).status, 'compared');
  candidate.metadata.protocolVersion = 7;
  assert.equal(m.compare(baseline, candidate).status, 'not-comparable');
  baseline.metadata.protocolVersion = 7;
  assert.equal(m.compare(baseline, candidate).status, 'compared');
  candidate.metadata.protocolVersion = 8;
  assert.equal(m.compare(baseline, candidate).status, 'not-comparable');
  baseline.metadata.protocolVersion = 8;
  assert.equal(m.compare(baseline, candidate).status, 'compared');
  candidate.metadata.protocolVersion = 9;
  assert.equal(m.compare(baseline, candidate).status, 'not-comparable');
  baseline.metadata.protocolVersion = 9;
  assert.equal(m.compare(baseline, candidate).status, 'compared');
  candidate.metadata.protocolVersion = 10;
  assert.equal(m.compare(baseline, candidate).status, 'not-comparable');
  baseline.metadata.protocolVersion = 10;
  assert.equal(m.compare(baseline, candidate).status, 'compared');
  candidate.metadata.protocolVersion = 11;
  assert.equal(m.compare(baseline, candidate).status, 'not-comparable');
  baseline.metadata.protocolVersion = 11;
  assert.equal(m.compare(baseline, candidate).status, 'compared');
  candidate.metadata.protocolVersion = 12;
  assert.equal(m.compare(baseline, candidate).status, 'not-comparable');
  baseline.metadata.protocolVersion = 12;
  assert.equal(m.compare(baseline, candidate).status, 'compared');
});
test('resúmenes y tendencias no afirman fugas ni inventan inicio', () => {
  const data = run();
  data.repetitions[1].memory.at(-1).pssKb.value = 120;
  data.repetitions[2].memory.at(-1).pssKb.value = 130;
  const summary = m.summarize(data);
  assert.equal(summary.finalPssKb.value.mean, 120);
  assert.equal(summary.memoryTrend.strictlyIncreasing, true);
  assert.equal(summary.memoryTrend.deltaFirstLastKb, 20);
  assert.equal(summary.memoryTrend.status, 'review-required');
  assert.equal(summary.launchMs.status, 'No medible');
});
