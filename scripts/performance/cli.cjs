const { spawnSync } = require('node:child_process');
const { mkdirSync, writeFileSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash, randomBytes } = require('node:crypto');
const { Buffer } = require('node:buffer');
const { performance } = require('node:perf_hooks');
const { setTimeout: delay } = require('node:timers/promises');
const { createInterface } = require('node:readline/promises');
const m = require('./metrics.cjs');

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
};
function options(argv) {
  const command = argv[0];
  if (!['diagnose', 'capture', 'compare', 'screenshot'].includes(command))
    throw new Error(
      'Uso: cli.cjs diagnose|capture|compare|screenshot. Ver docs/PERFORMANCE_TESTING.md.',
    );
  const allowed = {
    diagnose: ['device'],
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
async function capture(args, adb, metadata, dir) {
  if (!metadata.build.representative) throw new Error(metadata.qualification);
  if (!scenarios[args.scenario]) throw new Error('--scenario debe ser PERF-01 a PERF-05.');
  const config = conditions(args.conditions);
  const repeat = bounded(args.repeat, 3, 3, 10);
  const duration = bounded(args.duration, 60, 10, 600);
  const interval = bounded(args.interval, 5, 1, 30);
  const settle = bounded(args.settle, 15, 5, 120);
  if (interval >= duration) throw new Error('Intervalo debe ser menor que duración.');
  if (args.launch && (args.launch !== 'yes' || args.scenario !== 'PERF-01'))
    throw new Error('--launch yes solo para PERF-01.');
  metadata = {
    ...metadata,
    conditions: config,
    scenario: args.scenario,
    repeat,
    durationSeconds: duration,
    intervalSeconds: interval,
    settleSeconds: settle,
    launch: args.launch === 'yes',
    protocolVersion: 3,
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
      const before = m.graphics(
        adb(['shell', 'dumpsys', 'gfxinfo', APP, 'framestats']),
        windowIdentityKey,
      );
      record.graphicsBefore = before;
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
      console.log(`CAPTURANDO ${duration}s: realizar recorrido ahora.`);
      const deadline = performance.now() + duration * 1000;
      do {
        await delay(
          Math.min(interval * 1000, Math.max(0, deadline - performance.now())),
          undefined,
          { signal: controller.signal },
        );
        offline(adb);
        takeMemory('route');
        samples.push({
          ...m.graphics(adb(['shell', 'dumpsys', 'gfxinfo', APP, 'framestats']), windowIdentityKey),
          elapsedMs: performance.now() - started,
          at: new Date().toISOString(),
        });
      } while (performance.now() < deadline);
      record.graphics = m.frameSummary(before, samples.at(-1), samples);
      console.log(`Estabilizar ${settle}s en el punto final, sin interactuar.`);
      await delay(settle * 1000, undefined, { signal: controller.signal });
      offline(adb);
      takeMemory('settled');
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
    writeFileSync(
      path.join(dir, 'metrics.csv'),
      [
        'repetition,initialPssKb,finalPssKb,deltaPssKb,launchMs,jankPercent,slowPercent,frozenFrames,observation',
        ...metricRows.map((row) => row.join(',')),
      ].join('\n') + '\n',
      { flag: 'wx' },
    );
    writeFileSync(
      path.join(dir, 'summary.md'),
      `# ${args.scenario}\n\nEstado: ${run.status}. Objetivos: ${run.verdict}.\n\n${run.repetitions.length}/${repeat} repeticiones registradas. Ver scenarios.json, memory.csv y metrics.csv.\n\n| Rep | PSS inicial kB | PSS final kB | Delta kB | Inicio ms | Jank % | Lentos % | Congelados | Observación |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n${metricRows.map((row) => '| ' + row.join(' | ') + ' |').join('\n')}\n\nCPU: No medible (sin sondeo autorizado por proceso). FPS: No medible (sin fuente suficiente). Cierres: observación humana y muestreo, sin cobertura continua. Memoria: revisar tendencia estabilizada; delta no prueba fuga. Framestats: cobertura limitada a filas capturadas; jank no equivale a fotogramas lentos. Motivos por métrica en scenarios.json.\n`,
      { flag: 'wx' },
    );
  }
  if (run.status !== 'captured' || run.verdict === 'failed')
    throw new Error('Recorridos incompletos o umbral incumplido. Ver evidencias.');
}
async function main(argv = process.argv.slice(2)) {
  const args = options(argv);
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
module.exports = { options, bounded, conditions, offline, capture, main };
