const { spawnSync } = require('node:child_process');
const { mkdirSync, writeFileSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash, randomBytes } = require('node:crypto');
const { Buffer } = require('node:buffer');
const { performance } = require('node:perf_hooks');
const { setTimeout: delay } = require('node:timers/promises');
const { createInterface } = require('node:readline/promises');
const m = require('./metrics.cjs');
const native = require('./native-trace.cjs');
const { analyzeCpu } = require('./trace-cpu.cjs');
const presentation = require('./presentation.cjs');
const {
  startGraphicsStream,
  parseGraphicsStream,
  afterBaseline,
} = require('./graphics-stream.cjs');

const ROOT = path.dirname(require.resolve('../../package.json'));
const APP = 'com.cemydi.app';
const scenarios = {
  'PERF-01':
    'Desde el estado inicial anotado, abrir normalmente la app. Esperar estable. Sin forzar cierre ni borrar datos.',
  'PERF-02':
    'Explorar: desplazar 3 veces, buscar un producto de prueba, borrar búsqueda, aplicar y retirar disponibilidad. Datos ausentes: skipped.',
  'PERF-03':
    'Abrir producto de prueba, consultar descripción y características, desplazar 3 veces y volver a Explorar. Datos ausentes: skipped.',
  'PERF-04':
    'Como invitado, añadir producto de prueba local al carrito, aumentar y reducir cantidad, volver a Inicio. Datos ausentes: skipped.',
  'PERF-05':
    'Repetir 5 ciclos Inicio, Explorar, Detalle, Carrito, Inicio; al final esperar estabilización. Datos ausentes: skipped.',
  'PERF-06':
    'Renderizado de pantalla local: preparar manualmente Inicio → Ayuda y contacto (/perfil/ayuda), como invitado y al inicio del contenido. Desplazar verticalmente 3 veces, volver arriba y esperar estabilización. Registrar manualmente el resultado.',
};
function options(argv) {
  const command = argv[0];
  if (
    !['diagnose', 'capture', 'compare', 'screenshot', 'trace-check', 'analyze-cpu'].includes(
      command,
    )
  )
    throw new Error(
      'Uso: cli.cjs diagnose|capture|compare|screenshot|trace-check|analyze-cpu. Ver docs/PERFORMANCE_TESTING.md.',
    );
  const allowed = {
    diagnose: ['device'],
    'analyze-cpu': ['capture'],
    'trace-check': ['device', 'authorize'],
    capture: [
      'device',
      'authorize',
      'scenario',
      'conditions',
      'repeat',
      'duration',
      'interval',
      'settle',
      'launch',
      'native-trace',
    ],
    compare: ['baseline', 'candidate'],
    screenshot: ['device', 'authorize', 'no-sensitive-data'],
  }[command];
  const result = { command };
  for (let index = 1; index < argv.length; index += 2) {
    const key = argv[index].replace(/^--/, '');
    const value = argv[index + 1];
    if (
      !argv[index].startsWith('--') ||
      !allowed.includes(key) ||
      !value ||
      Object.hasOwn(result, key)
    )
      throw new Error('Opciones desconocidas, duplicadas o sin valor.');
    result[key] = value;
  }
  return result;
}
function execute(executable, args, binary = false) {
  const started = performance.now();
  const result = spawnSync(executable, args, {
    encoding: binary ? undefined : 'utf8',
    timeout: 15000,
    maxBuffer: 8 * 1024 * 1024,
    cwd: ROOT,
    windowsHide: true,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `Falló comando técnico ${path.basename(executable)} (exit=${result.status ?? 'sin salida'}). Se omitió stderr para no guardar datos privados.`,
    );
  return {
    output: binary ? result.stdout : result.stdout.trim(),
    durationMs: performance.now() - started,
  };
}
function adbClient(serial, timings) {
  if (!serial || !/^[\w.:-]+$/.test(serial))
    throw new Error('--device exige un serial ADB explícito.');
  const adb = process.env.CEMYDI_ADB || 'adb';
  m.deviceState(execute(adb, ['devices']).output, serial);
  return (args, binary = false) => {
    const started = performance.now();
    let status = 'failed';
    try {
      const result = execute(adb, ['-s', serial, ...args], binary);
      status = 'ok';
      return result.output;
    } finally {
      timings.push({
        at: new Date().toISOString(),
        command: ['adb', '-s', serial, ...args],
        durationMs: performance.now() - started,
        status,
      });
    }
  };
}
function directory(kind) {
  const target = path.join(
    ROOT,
    'test-results/performance',
    `${new Date().toISOString().replace(/[:.]/g, '-')}-${kind}-${randomUUID().slice(0, 8)}`,
  );
  mkdirSync(target, { recursive: true });
  return target;
}
function json(dir, name, value) {
  writeFileSync(path.join(dir, name), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}
function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new Error('No se pudo leer JSON válido. Se omitió contenido para evitar datos privados.');
  }
}
function diagnose(adb, serial) {
  const shell = (...args) => adb(['shell', ...args]);
  if (!/^package:/m.test(shell('pm', 'path', APP)))
    throw new Error('Paquete com.cemydi.app no instalado.');
  const build = m.build(shell('dumpsys', 'package', APP));
  const prop = (key) => shell('getprop', key);
  const version = require('../../package.json');
  return {
    at: new Date().toISOString(),
    device: serial,
    appId: APP,
    build,
    android: prop('ro.build.version.release'),
    sdk: prop('ro.build.version.sdk'),
    model: prop('ro.product.model'),
    fingerprint: prop('ro.build.fingerprint'),
    hardware: prop('ro.hardware'),
    abi: prop('ro.product.cpu.abilist'),
    memTotalKb: m.integer(shell('cat', '/proc/meminfo').match(/^MemTotal:\s+(\d+) kB/m)?.[1]),
    displaySize: shell('wm', 'size'),
    displayDensity: shell('wm', 'density'),
    host: {
      platform: process.platform,
      node: process.version,
      adb: execute(process.env.CEMYDI_ADB || 'adb', ['version'])
        .output.split(/\r?\n/)
        .slice(0, 2),
      expo: require('expo/package.json').version,
      reactNative: version.dependencies['react-native'],
    },
    gitCommit: execute('git', ['rev-parse', 'HEAD']).output,
    gitBranch: execute('git', ['branch', '--show-current']).output,
    gitDirty: Boolean(execute('git', ['status', '--porcelain']).output),
    cpu: m.unavailable('Sin sondeo por proceso autorizado; no se usa CPU agregada del sistema.'),
    qualification: build.representative
      ? 'release-compatible; procedencia preview/release debe confirmarse con APK/EAS'
      : 'Build no apta: se requiere preview/release sin DEBUGGABLE ni Dev Launcher.',
  };
}
function offline(adb) {
  const airplane = adb(['shell', 'settings', 'get', 'global', 'airplane_mode_on']);
  const wifi = adb(['shell', 'settings', 'get', 'global', 'wifi_on']);
  const connectivity = adb(['shell', 'dumpsys', 'connectivity']);
  if (
    airplane !== '1' ||
    wifi !== '0' ||
    !/^\s*Active default network:\s*(?:none|null)\s*$/m.test(connectivity)
  )
    throw new Error(
      'Aislamiento no verificable: activar manualmente modo avión, desactivar Wi-Fi y toda conexión de red. Formato desconocido también bloquea.',
    );
}
function bounded(value, fallback, min, max) {
  const number = m.integer(value ?? String(fallback));
  if (number === null || number < min || number > max)
    throw new Error(`Valor debe estar entre ${min} y ${max}.`);
  return number;
}
function conditions(file) {
  if (!file) throw new Error('--conditions requiere JSON sin datos personales.');
  const value = readJson(file);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Condiciones deben ser un objeto JSON.');
  const enums = {
    network: ['offline'],
    data: ['synthetic-local', 'empty-offline'],
    session: ['guest'],
    initialState: ['foreground', 'background', 'not-running'],
    battery: ['20-49', '50-79', '80-100'],
    charging: ['yes', 'no'],
    thermal: ['cool', 'warm'],
    brightness: ['low', 'medium', 'high'],
    animations: ['default'],
    cache: ['empty', 'warm'],
    orientation: ['portrait'],
  };
  if (Object.keys(value).some((key) => !Object.hasOwn(enums, key)))
    throw new Error('Campos de condiciones desconocidos.');
  for (const [key, values] of Object.entries(enums))
    if (!values.includes(value[key])) throw new Error(`Condición inválida/ausente: ${key}.`);
  return Object.fromEntries(Object.keys(enums).map((key) => [key, value[key]]));
}
function captureConfig(args) {
  if (
    args['native-trace'] !== undefined &&
    (args['native-trace'] !== 'yes' || args.scenario !== 'PERF-06')
  )
    throw new Error('--native-trace yes solo para PERF-06.');
  if (!Object.hasOwn(scenarios, args.scenario))
    throw new Error('--scenario debe ser PERF-01 a PERF-06.');
  const config = conditions(args.conditions);
  const repeat = bounded(args.repeat, 3, 3, 10);
  const duration = bounded(args.duration, args.scenario === 'PERF-06' ? 30 : 60, 10, 600);
  const interval = bounded(args.interval, args.scenario === 'PERF-06' ? 1 : 5, 1, 30);
  const settle = bounded(args.settle, 15, 5, 120);
  if (interval >= duration) throw new Error('Intervalo debe ser menor que duración.');
  if (args.launch && (args.launch !== 'yes' || args.scenario !== 'PERF-01'))
    throw new Error('--launch yes solo para PERF-01.');
  if (
    args.scenario === 'PERF-06' &&
    (config.initialState !== 'foreground' || config.data !== 'empty-offline')
  )
    throw new Error('PERF-06 requiere initialState foreground y data empty-offline.');
  return { config, repeat, duration, interval, settle };
}
async function capture(args, adb, metadata, dir) {
  if (!metadata.build.representative) throw new Error(metadata.qualification);
  const { config, repeat, duration, interval, settle } = captureConfig(args);
  metadata = {
    ...metadata,
    conditions: config,
    scenario: args.scenario,
    repeat,
    durationSeconds: duration,
    intervalSeconds: interval,
    settleSeconds: settle,
    launch: args.launch === 'yes',
    protocolVersion: args['native-trace'] === 'yes' ? 12 : 3,
    ...(args['native-trace'] === 'yes'
      ? {
          instrumentation: 'perfetto-v9-frame-identities-fence-resolution-coverage',
          graphicsSleepRequestedMs: 10,
          cpu: m.unavailable('CPU del recorrido se evalúa en cpuFromTrace y cpu.json.'),
        }
      : {}),
  };
  json(dir, 'metadata.json', metadata);
  // Stable only for this capture; never log or persist this HMAC key.
  const windowIdentityKey = randomBytes(32);
  const run = { schemaVersion: 1, metadata, status: 'incomplete', repetitions: [] };
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const controller = new AbortController();
  const cancel = () => controller.abort();
  prompt.on('SIGINT', cancel);
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  let activeTrace;
  let activeGraphics;
  try {
    for (let rep = 1; rep <= repeat; rep++) {
      console.log(`\n${args.scenario} repetición ${rep}/${repeat}. ${scenarios[args.scenario]}`);
      if (
        (await prompt.question(
          'Preparar mismo estado inicial, sin cuentas reales ni red. Escribir ready: ',
          { signal: controller.signal },
        )) !== 'ready'
      )
        throw new Error('Captura cancelada por operador.');
      offline(adb);
      const record = {
        repetition: rep,
        status: 'incomplete',
        observation: 'pending',
        startedAt: new Date().toISOString(),
        memory: [],
        graphics: m.unavailable('Captura incompleta.'),
        launch: m.unavailable('Apertura manual; no hay TotalTime ADB.'),
      };
      run.repetitions.push(record);
      const started = performance.now();
      const takeMemory = (phase) => {
        const pssKb = m.memory(adb(['shell', 'dumpsys', 'meminfo', APP]));
        record.memory.push({ elapsedMs: performance.now() - started, phase, pssKb });
        if (pssKb.status !== 'measured') throw new Error(pssKb.reason);
      };
      // A missing process is valid only for the initial launch state.
      const initialPss = m.memory(adb(['shell', 'dumpsys', 'meminfo', APP]));
      record.initialPssKb = initialPss;
      if (args.scenario !== 'PERF-01' && initialPss.status !== 'measured')
        throw new Error('Se necesita proceso inicial activo para este recorrido.');
      let before = m.graphics(
        adb(['shell', 'dumpsys', 'gfxinfo', APP, 'framestats']),
        windowIdentityKey,
      );
      record.graphicsBefore = before;
      let layer;
      const takePresentation = () => {
        try {
          return presentation.latency(
            adb(['shell', 'dumpsys', 'SurfaceFlinger', '--latency', layer]),
          );
        } catch {
          return m.unavailable('Consulta SurfaceFlinger no disponible.');
        }
      };
      if (args['native-trace'] === 'yes') {
        try {
          layer = presentation.selectLayer(adb(['shell', 'dumpsys', 'SurfaceFlinger', '--list']));
        } catch {
          layer = null;
        }
        record.presentationSamples = [];
        record.cpuSamples = [];
        record.trace = { status: 'pending' };
        activeTrace = native
          .startTrace(args.device, duration + 10, dir, rep, controller.signal)
          .then((info) => {
            record.trace = info;
            return info;
          });
      }
      record.launchContext = {
        declaredInitialState: config.initialState,
        processAlreadyPresent: initialPss.status === 'measured' ? true : null,
        classification: 'unknown; no se deduce inicio frío/caliente solo de TotalTime o PSS',
      };
      const samples = [];
      record.graphicsSamples = samples;
      if (metadata.launch) {
        const component = adb([
          'shell',
          'cmd',
          'package',
          'resolve-activity',
          '--brief',
          '-a',
          'android.intent.action.MAIN',
          '-c',
          'android.intent.category.LAUNCHER',
          APP,
        ])
          .split(/\r?\n/)
          .at(-1);
        if (!/^com\.cemydi\.app\/[\w.$]+$/.test(component))
          throw new Error('Actividad MAIN inválida.');
        const launchOutput = adb(['shell', 'am', 'start', '-W', '-n', component]);
        record.launchDiagnostics = m.launchDiagnostics(launchOutput);
        record.launch = m.launch(launchOutput);
      }
      if (activeTrace) await delay(2000, undefined, { signal: controller.signal });
      if (activeTrace && record.trace.status === 'failed')
        throw new Error(`Falló traza nativa: ${record.trace.reason}`);
      if (activeTrace) {
        activeGraphics = startGraphicsStream(args.device, duration + 5, controller.signal);
        record.graphicsStreamStartUptimeSeconds = adb(['shell', 'cat', '/proc/uptime']).split(
          /\s+/,
        )[0];
        before = m.graphics(
          adb(['shell', 'dumpsys', 'gfxinfo', APP, 'framestats']),
          windowIdentityKey,
        );
        record.graphicsBefore = before;
        if (layer) record.presentationSamples.push(takePresentation());
      }
      if (activeTrace)
        record.traceRouteStartUptimeSeconds = adb(['shell', 'cat', '/proc/uptime']).split(/\s+/)[0];
      console.log(`CAPTURANDO ${duration}s: realizar recorrido ahora.`);
      const routeStarted = performance.now();
      const deadline = routeStarted + duration * 1000;
      let nextMemory = routeStarted + interval * 1000;
      do {
        await delay(
          Math.min(interval * 1000, Math.max(0, deadline - performance.now())),
          undefined,
          { signal: controller.signal },
        );
        if (activeTrace && record.trace.status === 'failed')
          throw new Error(`Falló traza nativa: ${record.trace.reason}`);
        if (!activeTrace || performance.now() >= nextMemory) {
          offline(adb);
          takeMemory('route');
          nextMemory = performance.now() + interval * 1000;
        }
        samples.push({
          ...m.graphics(adb(['shell', 'dumpsys', 'gfxinfo', APP, 'framestats']), windowIdentityKey),
          elapsedMs: performance.now() - started,
          at: new Date().toISOString(),
        });
        if (layer) record.presentationSamples.push(takePresentation());
      } while (performance.now() < deadline);
      if (activeGraphics) {
        record.graphicsStreamEndUptimeSeconds = adb(['shell', 'cat', '/proc/uptime']).split(
          /\s+/,
        )[0];
        samples.push({
          ...m.graphics(adb(['shell', 'dumpsys', 'gfxinfo', APP, 'framestats']), windowIdentityKey),
          elapsedMs: performance.now() - started,
          at: new Date().toISOString(),
        });
        if (layer) record.presentationSamples.push(takePresentation());
      }
      if (activeTrace)
        record.traceRouteEndUptimeSeconds = adb(['shell', 'cat', '/proc/uptime']).split(/\s+/)[0];
      record.graphics = m.frameSummary(before, samples.at(-1), samples);
      console.log(`Estabilizar ${settle}s en el punto final, sin interactuar.`);
      await delay(settle * 1000, undefined, { signal: controller.signal });
      offline(adb);
      takeMemory('settled');
      if (activeGraphics) {
        const stream = await activeGraphics;
        activeGraphics = null;
        record.graphicsStream = { status: stream.status, sleepRequestedMs: 10 };
        if (stream.status === 'captured') {
          const continuous = afterBaseline(
            parseGraphicsStream(
              stream.text,
              record.graphicsStreamStartUptimeSeconds,
              record.graphicsStreamEndUptimeSeconds,
              (text) => m.graphics(text, windowIdentityKey),
            ),
            before,
          );
          record.graphicsStream.samples = continuous.length;
          // Keep the synchronous final snapshot last: its counters define the
          // unchanged HWUI coverage check and exclude all later samples.
          const final = samples.at(-1);
          record.continuousGraphicsSamples = continuous;
          record.graphics = m.frameSummary(before, final, [...continuous, final]);
        }
      }
      if (args['native-trace'] === 'yes') {
        record.presentationResolutionSamples = layer ? [takePresentation()] : [];
        let sameLayer = false;
        try {
          sameLayer =
            Boolean(layer) &&
            layer ===
              presentation.selectLayer(adb(['shell', 'dumpsys', 'SurfaceFlinger', '--list']));
        } catch {
          /* Missing source stays No medible. */
        }
        record.presentation = presentation.presentationSummary(
          record.presentationSamples,
          sameLayer,
          record.presentationResolutionSamples,
        );
      }
      if (activeTrace) {
        record.trace = await activeTrace;
        activeTrace = null;
        if (record.trace.status !== 'captured')
          throw new Error('Falló traza nativa. Conservar evidencia parcial y revisar trace.json.');
        record.traceCoverage = native.routeCoverage(
          record.trace.diagnostics.validation,
          record.traceRouteStartUptimeSeconds,
          record.traceRouteEndUptimeSeconds,
        );
        record.cpuFromTrace = analyzeCpu(
          readFileSync(path.join(dir, record.trace.file)),
          before.pid,
          record.traceRouteStartUptimeSeconds,
          record.traceRouteEndUptimeSeconds,
        );
      }
      record.memoryDeltaKb =
        initialPss.status === 'measured'
          ? m.measured(record.memory.at(-1).pssKb.value - initialPss.value)
          : m.unavailable('Proceso inicial ausente.');
      record.durationMs = performance.now() - started;
      const answer = await prompt.question(
        'Resultado observado (completed / skipped / crash / error): ',
        { signal: controller.signal },
      );
      record.observation = ['completed', 'skipped', 'crash', 'error'].includes(answer)
        ? answer
        : 'error';
      record.status = 'captured';
      json(dir, `repetition-${rep}.json`, record);
    }
    run.status = run.repetitions.every((rep) => rep.observation === 'completed')
      ? 'captured'
      : 'incomplete';
  } finally {
    if (activeGraphics) {
      controller.abort();
      await activeGraphics;
    }
    if (activeTrace) {
      controller.abort();
      run.repetitions.at(-1).trace = await activeTrace;
    }
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
    prompt.removeListener('SIGINT', cancel);
    prompt.close();
    run.verdict = m.objectives(run);
    run.summary = m.summarize(run);
    run.finishedAt = new Date().toISOString();
    json(dir, 'scenarios.json', run);
    const csv = [
      'repetition,elapsedMs,phase,pssKb',
      ...run.repetitions.flatMap((rep) =>
        rep.memory.map(
          (sample) =>
            `${rep.repetition},${sample.elapsedMs.toFixed(2)},${sample.phase},${sample.pssKb.status === 'measured' ? sample.pssKb.value : ''}`,
        ),
      ),
    ];
    writeFileSync(path.join(dir, 'memory.csv'), `${csv.join('\n')}\n`, { flag: 'wx' });
    const value = (metric) => (metric?.status === 'measured' ? metric.value : 'No medible');
    const metricRows = run.repetitions.map((rep) => [
      rep.repetition,
      value(rep.initialPssKb),
      value(rep.memory.at(-1)?.pssKb),
      value(rep.memoryDeltaKb),
      value(rep.launch),
      rep.graphics.status === 'measured' ? rep.graphics.value.jankPercent : 'No medible',
      value(rep.graphics.value?.slowPercent),
      value(rep.graphics.value?.frozenFrames),
      rep.observation,
    ]);
    if (args['native-trace'] === 'yes')
      writeFileSync(
        path.join(dir, 'cpu.json'),
        JSON.stringify(
          {
            source: 'Perfetto sched_switch; sin sondeo dumpsys cpuinfo',
            repetitions: run.repetitions.map((rep) => ({
              repetition: rep.repetition,
              trace: rep.cpuFromTrace ?? { process: m.unavailable('Sin análisis de traza CPU.') },
              samples: rep.cpuSamples ?? [],
              status: rep.cpuFromTrace?.process.status ?? 'No medible',
            })),
          },
          null,
          2,
        ) + '\n',
        { flag: 'wx' },
      );
    if (args['native-trace'] === 'yes')
      json(dir, 'presentation.json', {
        repetitions: run.repetitions.map((rep) => ({
          repetition: rep.repetition,
          presentation: rep.presentation ?? m.unavailable('Captura incompleta.'),
        })),
      });
    writeFileSync(
      path.join(dir, 'metrics.csv'),
      [
        'repetition,initialPssKb,finalPssKb,deltaPssKb,launchMs,jankPercent,slowPercent,frozenFrames,observation',
        ...metricRows.map((row) => row.join(',')),
      ].join('\n') + '\n',
      { flag: 'wx' },
    );
    const cpuNote =
      args['native-trace'] === 'yes'
        ? 'CPU: consultar el estado y motivos en cpu.json y cpuFromTrace; sin sondeo cpuinfo. Consultar FPS en presentation.json y cobertura HWUI en scenarios.json.'
        : 'CPU: No medible (sin sondeo autorizado por proceso).';
    writeFileSync(
      path.join(dir, 'summary.md'),
      `# ${args.scenario}\n\nEstado: ${run.status}. Objetivos: ${run.verdict}.\n\n${run.repetitions.length}/${repeat} repeticiones registradas. Ver scenarios.json, memory.csv y metrics.csv.\n\n| Rep | PSS inicial kB | PSS final kB | Delta kB | Inicio ms | Jank % | Lentos % | Congelados | Observación |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n${metricRows.map((row) => '| ' + row.join(' | ') + ' |').join('\n')}\n\n${cpuNote} FPS: ${args['native-trace'] === 'yes' ? 'consultar presentation.json; ventana de presentaciones, no promedio de 30s' : 'No medible (sin fuente de presentación)'}. Cierres: observación humana y muestreo, sin cobertura continua. Memoria: revisar tendencia estabilizada; delta no prueba fuga. Framestats: cobertura limitada a filas capturadas; jank no equivale a fotogramas lentos. Motivos por métrica en scenarios.json.\n`,
      { flag: 'wx' },
    );
  }
  if (run.status !== 'captured' || run.verdict === 'failed')
    throw new Error('Recorridos incompletos o umbral incumplido. Ver evidencias.');
}
async function main(argv = process.argv.slice(2)) {
  const args = options(argv);
  if (args.command === 'analyze-cpu') {
    if (!args.capture) throw new Error('--capture requiere carpeta de evidencia.');
    const run = readJson(path.join(args.capture, 'scenarios.json'));
    if (run.schemaVersion !== 1 || !Array.isArray(run.repetitions))
      throw new Error('Captura no compatible.');
    const repetitions = run.repetitions.map((rep) => {
      const trace = rep.trace;
      if (
        trace?.status !== 'captured' ||
        trace.file !== `repetition-${rep.repetition}.perfetto-trace`
      )
        return {
          repetition: rep.repetition,
          cpu: { process: m.unavailable('Falta traza capturada.') },
        };
      const buffer = readFileSync(path.join(args.capture, trace.file));
      const sha256 = createHash('sha256').update(buffer).digest('hex');
      if (sha256 !== trace.sha256) throw new Error('Hash de traza CPU no coincide.');
      return {
        repetition: rep.repetition,
        traceSha256: sha256,
        cpu: analyzeCpu(
          buffer,
          rep.graphicsBefore?.pid,
          rep.traceRouteStartUptimeSeconds,
          rep.traceRouteEndUptimeSeconds,
        ),
      };
    });
    const dir = directory('cpu-analysis');
    json(dir, 'cpu.json', { source: 'offline-perfetto-sched-switch', repetitions });
    console.log(`Evidencias CPU: ${dir}`);
    return;
  }
  if (args.command === 'compare') {
    if (!args.baseline || !args.candidate)
      throw new Error('Especificar --baseline y --candidate (scenarios.json).');
    const baseline = readJson(args.baseline);
    const candidate = readJson(args.candidate);
    let report;
    try {
      report = m.compare(baseline, candidate);
    } catch {
      throw new Error('Reportes de comparación inválidos o con schema no compatible.');
    }
    const dir = directory('comparison');
    json(dir, 'comparison.json', {
      ...report,
      at: new Date().toISOString(),
      sources: {
        baselineSha256: createHash('sha256').update(readFileSync(args.baseline)).digest('hex'),
        candidateSha256: createHash('sha256').update(readFileSync(args.candidate)).digest('hex'),
      },
    });
    console.log(`${dir}\n${JSON.stringify(report, null, 2)}`);
    if (report.status !== 'compared' || report.verdict === 'failed') process.exitCode = 1;
    return;
  }
  if (args.command !== 'diagnose' && (!args.device || args.authorize !== args.device))
    throw new Error('--authorize debe coincidir con --device: autorización explícita de captura.');
  const timings = [];
  const dir = directory(args.command);
  console.log(`Evidencias: ${dir}`);
  try {
    const adb = adbClient(args.device, timings);
    if (args.command === 'trace-check') {
      offline(adb);
      console.log('Comprobando Perfetto durante 10 s. Mantener el teléfono sin conexión.');
      const report = await native.startTrace(args.device, 10, dir, 1, new AbortController().signal);
      offline(adb);
      console.log(JSON.stringify(report, null, 2));
      if (report.status !== 'captured')
        throw new Error('Perfetto no validado. Compartir la carpeta trace-check completa.');
      return;
    }
    if (args.command === 'screenshot') {
      if (args['no-sensitive-data'] !== 'yes')
        throw new Error('Revisar pantalla y especificar --no-sensitive-data yes.');
      const image = adb(['exec-out', 'screencap', '-p'], true);
      if (!image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
        throw new Error('screencap no devolvió PNG.');
      writeFileSync(path.join(dir, 'screen.png'), image, { flag: 'wx' });
      return;
    }
    const metadata = diagnose(adb, args.device);
    if (args.command === 'diagnose') {
      json(dir, 'metadata.json', metadata);
      console.log(JSON.stringify(metadata, null, 2));
    } else await capture(args, adb, metadata, dir);
  } catch (error) {
    // Error messages here are controlled; no raw ADB stderr or private UI.
    json(dir, 'error.json', {
      status: 'failed',
      message: error.message,
      at: new Date().toISOString(),
    });
    throw error;
  } finally {
    json(dir, 'timings.json', timings);
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { options, bounded, conditions, offline, captureConfig, capture, main };
