// Only numeric, allowlisted ADB fields leave the parsers. Never persist full dumps.
const { createHmac, randomBytes } = require('node:crypto');
// Ephemeral fallback for standalone inspection/tests; never persisted or exported.
const defaultWindowKey = randomBytes(32);
const unavailable = (reason) => ({ status: 'No medible', reason });
const measured = (value) => ({ status: 'measured', value });
function integer(value) {
  if (!/^\d+$/.test(String(value))) return null;
  const result = Number(value);
  return Number.isSafeInteger(result) ? result : null;
}
function memory(text) {
  if ([...text.matchAll(/\*\* MEMINFO in pid/g)].length > 1)
    return unavailable('Múltiples procesos: PSS ambiguo.');
  const values = [...text.matchAll(/^\s*TOTAL(?:\s+PSS:)?\s+(\S+)/gm)]
    .map((match) => integer(match[1]))
    .filter((value) => value !== null);
  const unique = [...new Set(values)];
  return unique.length === 1
    ? measured(unique[0])
    : unavailable('TOTAL PSS ausente, ambiguo o inválido; proceso ausente o formato desconocido.');
}
// Structure only: scopes describe nearby printed markers, not counter ownership.
// Never export report lines, window titles, package names or arbitrary headings.
function graphicsStructure(text) {
  let processIndex = 0;
  let sectionIndex = 0;
  let region = 'unknown';
  let statsBlock = 0;
  const events = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    let kind;
    if (/^\*\* Graphics info for pid \d+\b/.test(line)) {
      processIndex++;
      region = 'process-preamble';
      statsBlock = 0;
      kind = 'process-header';
    } else if (line === 'Profile data in ms:') {
      region = 'profile-data';
      kind = 'profile-header';
    } else if (/^Window:/.test(line)) {
      region = 'window';
      kind = 'window-header';
    } else if (/^Package:/.test(line)) {
      region = 'package';
      kind = 'package-header';
    } else if (line === '---PROFILEDATA---') {
      region = 'framestats-boundary';
      kind = 'framestats-boundary';
    } else if (line.startsWith('Flags,')) {
      region = 'framestats';
      kind = 'framestats-header';
    } else if (line === 'View hierarchy:') {
      region = 'view-hierarchy';
      kind = 'view-hierarchy-header';
    } else if (/^Pipeline=/.test(line)) {
      region = 'pipeline';
      kind = 'pipeline-header';
    } else if (/^Stats since:/.test(line)) {
      statsBlock++;
      kind = 'stats-since';
    } else if (
      /^[^:]+:[\t ]*$/.test(line) &&
      !/^(?:Total frames rendered|Janky frames):/.test(line)
    ) {
      region = 'unknown';
      kind = 'unknown-header';
    }
    // Counter labels without a recognized value still produce a null event.
    const total = /^Total frames rendered:/.test(line);
    const janky = /^Janky frames:/.test(line);
    if (total || janky) {
      const match = total
        ? line.match(/^Total frames rendered:[\t ]*(\S+)[\t ]*$/)
        : line.match(/^Janky frames:[\t ]*(\S+)[\t ]+\(/);
      events.push({
        line: index + 1,
        kind: total ? 'total-counter' : 'janky-counter',
        processIndex,
        sectionIndex,
        region,
        statsBlock,
        value: match ? integer(match[1]) : null,
      });
    } else if (kind) {
      if (kind !== 'stats-since') sectionIndex++;
      events.push({ line: index + 1, kind, processIndex, sectionIndex, region, statsBlock });
    }
  }
  return { schemaVersion: 1, ownership: 'unverified', events };
}
function windowProfile(text, structure, identityKey) {
  const events = structure.events;
  const byKind = (kind) => events.filter((event) => event.kind === kind);
  const processes = byKind('process-header');
  const windows = byKind('window-header');
  const boundaries = byKind('framestats-boundary');
  const headers = byKind('framestats-header');
  const profiles = byKind('profile-header');
  if (
    processes.length !== 1 ||
    windows.length !== 1 ||
    profiles.length !== 1 ||
    boundaries.length !== 2 ||
    headers.length !== 1
  )
    return unavailable(
      'Se requiere un proceso, una ventana y un bloque framestats cerrado e inequívoco.',
    );
  const [window] = windows;
  const [open, close] = boundaries;
  const [header] = headers;
  if (!(
    processes[0].line < profiles[0].line &&
    profiles[0].line < window.line &&
    window.line < open.line &&
    open.line < header.line &&
    header.line < close.line
  ))
    return unavailable('Orden de ventana/contadores/framestats desconocido.');
  const stats = byKind('stats-since').filter(
    (event) => event.line > window.line && event.line < open.line,
  );
  const counters = events.filter(
    (event) =>
      event.kind.endsWith('-counter') && event.line > window.line && event.line < open.line,
  );
  const totals = counters.filter((event) => event.kind === 'total-counter');
  const jankies = counters.filter((event) => event.kind === 'janky-counter');
  if (stats.length !== 1 || totals.length !== 1 || jankies.length !== 1)
    return unavailable('La ventana no contiene un único Stats since y un único par de contadores.');
  const [epoch] = stats;
  const [total] = totals;
  const [janky] = jankies;
  if (
    total.value === null ||
    janky.value === null ||
    janky.value > total.value ||
    total.line <= epoch.line ||
    janky.line <= total.line ||
    counters.some(
      (event) =>
        event.processIndex !== 1 ||
        event.region !== 'window' ||
        event.sectionIndex !== window.sectionIndex ||
        event.statsBlock !== epoch.statsBlock,
    )
  )
    return unavailable('Contadores de ventana inválidos o repartidos entre bloques.');
  // Do not allow other markers or counters to intervene in this window's trace.
  if (
    events.some(
      (event) =>
        event.line > window.line &&
        event.line < close.line &&
        ![
          'stats-since',
          'total-counter',
          'janky-counter',
          'framestats-boundary',
          'framestats-header',
        ].includes(event.kind),
    ) ||
    events.some((event) => event.kind.endsWith('-counter') && event.line > open.line)
  )
    return unavailable('La asociación entre ventana y framestats contiene secciones inesperadas.');
  const lines = text.split('\n');
  const name = lines[window.line - 1].trim().slice('Window:'.length).trim();
  const since = lines[epoch.line - 1].trim().match(/^Stats since:[\t ]*([1-9]\d*)ns[\t ]*$/)?.[1];
  if (!name || name.length > 2048 || !since)
    return unavailable('Falta identidad de ventana o época Stats since verificable.');
  const fields = lines[header.line - 1].trim().split(',');
  const required = ['Flags', 'IntendedVsync', 'FrameCompleted'];
  const validHeader = required.every(
    (field) => fields.filter((value) => value === field).length === 1,
  );
  const frames = [];
  let invalidRows = validHeader ? 0 : 1;
  for (const line of lines.slice(header.line, close.line - 1)) {
    if (!line.trim()) continue;
    const columns = line.trim().split(',');
    const get = (key) => integer(columns[fields.indexOf(key)]);
    const flags = get('Flags');
    const start = get('IntendedVsync');
    const end = get('FrameCompleted');
    if (!validHeader || flags === null || start === null || end === null || end <= start) {
      invalidRows++;
      continue;
    }
    if (flags === 0) frames.push({ start, end, durationMs: (end - start) / 1e6 });
  }
  return measured({
    counters: { total: total.value, janky: janky.value },
    frames,
    invalidRows,
    source: {
      format: 'android10-single-window-v1',
      region: 'window',
      processIndex: 1,
      sectionIndex: window.sectionIndex,
      statsBlock: epoch.statsBlock,
      statsSinceNs: since,
      windowId: createHmac('sha256', identityKey).update(name).digest('hex'),
      frameRegion: 'framestats',
    },
  });
}
function graphics(text, identityKey = defaultWindowKey) {
  text = text.replace(/\r\n?/g, '\n');
  const structure = graphicsStructure(text);
  const totalMatches = [...text.matchAll(/^[\t ]*Total frames rendered:[\t ]*(\S+)[\t ]*$/gm)];
  const jankyMatches = [...text.matchAll(/^[\t ]*Janky frames:[\t ]*(\S+)[\t ]+\(/gm)];
  const processSections = [...text.matchAll(/\*\* Graphics info for pid /g)].length;
  const selected = windowProfile(text, structure, identityKey);
  const value = selected.status === 'measured' && processSections === 1 ? selected.value : null;
  const frames = value?.frames ?? [];
  const failure =
    selected.status === 'No medible' ? selected : unavailable('Múltiples procesos gráficos.');
  return {
    pid: integer(text.match(/\*\* Graphics info for pid (\d+)/)?.[1]),
    counters: value ? measured(value.counters) : failure,
    source: value?.source ?? null,
    frames,
    invalidRows: value?.invalidRows ?? 0,
    timings: frames.length ? 'measured' : 'No medible',
    diagnostics: {
      processSections,
      totalLabels: [...text.matchAll(/Total frames rendered:/g)].length,
      jankyLabels: [...text.matchAll(/Janky frames:/g)].length,
      totalMatches: totalMatches.length,
      jankyMatches: jankyMatches.length,
      totalValues: totalMatches.map((match) => integer(match[1])),
      jankyValues: jankyMatches.map((match) => integer(match[1])),
      frameHeaders: [...text.matchAll(/^Flags,/gm)].length,
      structure,
      windowSelection: value ? measured(value.source) : failure,
    },
  };
}
function launchDiagnostics(text) {
  text = text.replace(/\r\n?/g, '\n');
  const timing = (name) => {
    const matches = [...text.matchAll(new RegExp(`^${name}:[\\t ]*(\\S+)[\\t ]*$`, 'gm'))];
    return matches.length === 1 ? integer(matches[0][1]) : null;
  };
  return {
    statusOk: /^Status:[\t ]*ok[\t ]*$/m.test(text),
    taskBroughtToFront:
      /Warning: Activity not started, its current task has been brought to the front/.test(text),
    intentDelivered: /Warning: Activity not started, intent has been delivered/.test(text),
    hasWarning: /Warning:/.test(text),
    hasError: /Error:|Exception/.test(text),
    totalTimeMs: timing('TotalTime'),
    thisTimeMs: timing('ThisTime'),
    waitTimeMs: timing('WaitTime'),
    reportedLaunchState: text.match(/^LaunchState:[\t ]*(COLD|WARM|HOT)[\t ]*$/m)?.[1] ?? 'unknown',
  };
}
function launch(text) {
  const info = launchDiagnostics(text);
  if (info.taskBroughtToFront || info.intentDelivered)
    return unavailable(
      'Actividad/tarea existente reutilizada; retorno al primer plano, no lanzamiento nuevo. WaitTime no sustituye TotalTime.',
    );
  if (!info.statusOk || info.hasWarning || info.hasError || info.totalTimeMs === null)
    return unavailable('am start -W no informó un lanzamiento nuevo válido con TotalTime.');
  return measured(info.totalTimeMs);
}
function build(text) {
  const flags = text.match(/^\s*(?:pkgFlags|flags)=\[([^\]]*)\]/m)?.[1];
  const versionCode = text.match(/\bversionCode=(\d+)\b/)?.[1];
  const versionName = text.match(/^\s*versionName=([\w.+-]+)\s*$/m)?.[1];
  const updated = text.match(/^\s*lastUpdateTime=([\d\s:+-]+)\s*$/m)?.[1]?.trim();
  const debuggable = flags === undefined ? null : /\bDEBUGGABLE\b/.test(flags);
  const devLauncher = text.includes('expo.modules.devlauncher');
  return {
    versionCode: integer(versionCode),
    versionName: versionName ?? null,
    updated: updated ?? null,
    debuggable,
    devLauncher,
    type: devLauncher
      ? 'development'
      : debuggable === false
        ? 'release-compatible'
        : 'unknown/debug',
    representative:
      debuggable === false && !devLauncher && Boolean(versionCode && versionName && updated),
  };
}
function deviceState(text, serial) {
  const row = text.split(/\r?\n/).find((line) => line.split(/\s+/)[0] === serial);
  if (!row || row.split(/\s+/)[1] !== 'device')
    throw new Error('Dispositivo explícito ausente, desconectado, offline o no autorizado.');
  return true;
}
function frameSummary(before, after, samples) {
  const snapshots = [...samples, after];
  if (
    before.pid === null ||
    after.pid !== before.pid ||
    snapshots.some((sample) => sample.pid !== before.pid)
  )
    return unavailable('PID gráfico ausente o distinto durante el intervalo.');
  if (before.counters.status !== 'measured' || after.counters.status !== 'measured')
    return unavailable('Sin contadores iniciales/finales válidos.');
  if (snapshots.some((sample) => sample.counters.status !== 'measured'))
    return unavailable('Muestra con contadores gráficos inválidos; consultar diagnostics.');
  if (
    before.source?.format !== 'android10-single-window-v1' ||
    !before.source.windowId ||
    snapshots.some((sample) => JSON.stringify(sample.source) !== JSON.stringify(before.source))
  )
    return unavailable(
      'Cambió ventana, región, bloque lógico o época Stats since; falta continuidad verificable.',
    );
  let previous = before.counters.value;
  for (const sample of snapshots) {
    if (
      sample.counters.value.total < previous.total ||
      sample.counters.value.janky < previous.janky
    )
      return unavailable('Contadores reiniciados durante el intervalo.');
    if (sample.counters.value.janky - previous.janky > sample.counters.value.total - previous.total)
      return unavailable('Incremento janky mayor que incremento total en una muestra.');
    previous = sample.counters.value;
  }
  const total = after.counters.value.total - before.counters.value.total;
  const janky = after.counters.value.janky - before.counters.value.janky;
  if (total === 0 && janky === 0)
    return unavailable(
      'Sin frames nuevos según contadores; reposo o retorno sin dibujo. No equivale a 0 % de jank.',
    );
  if (total <= 0 || janky < 0 || janky > total)
    return unavailable('Contadores reiniciados/inconsistentes.');
  const initial = new Set(before.frames.map((frame) => `${frame.start}:${frame.end}`));
  const unique = new Map();
  for (const sample of snapshots)
    for (const frame of sample.frames)
      if (!initial.has(`${frame.start}:${frame.end}`))
        unique.set(`${frame.start}:${frame.end}`, frame);
  const frames = [...unique.values()];
  // The ring buffer may omit frames. A partial trace must never pass the objective.
  const complete =
    before.invalidRows === 0 &&
    frames.length === total &&
    snapshots.every((sample) => sample.invalidRows === 0);
  return measured({
    total,
    janky,
    jankPercent: (100 * janky) / total,
    capturedFrames: frames.length,
    source: before.source,
    slowPercent: complete
      ? measured((100 * frames.filter((f) => f.durationMs > 16.667).length) / total)
      : unavailable('Cobertura framestats incompleta o no verificable.'),
    frozenFrames: complete
      ? measured(frames.filter((f) => f.durationMs > 700).length)
      : unavailable('Cobertura framestats incompleta o no verificable.'),
  });
}
function objectives(run) {
  const states = run.repetitions.map((rep) => {
    if (rep.observation === 'crash') return 'failed';
    if (rep.observation !== 'completed' || rep.status !== 'captured') return 'pending';
    if (rep.graphics.status !== 'measured') return 'pending';
    const { slowPercent, frozenFrames } = rep.graphics.value;
    if (
      (slowPercent.status === 'measured' && slowPercent.value >= 10) ||
      (frozenFrames.status === 'measured' && frozenFrames.value > 0)
    )
      return 'failed';
    return 'pending'; // Memory trend + crashes between samples require human review.
  });
  return states.includes('failed') ? 'failed' : 'pending';
}
function summarize(run) {
  const stats = (values) =>
    values.length && values.every((value) => Number.isFinite(value) && value >= 0)
      ? measured({
          count: values.length,
          mean: values.reduce((sum, value) => sum + value, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
        })
      : unavailable('Muestras ausentes o inválidas.');
  const final = run.repetitions.map((rep) => rep.memory.at(-1)?.pssKb);
  const finals = final.filter((point) => point?.status === 'measured').map((point) => point.value);
  const graphics = run.repetitions.map((rep) => rep.graphics);
  return {
    finalPssKb: final.every((point) => point?.status === 'measured')
      ? stats(finals)
      : unavailable('PSS final incompleto.'),
    launchMs: run.repetitions.every((rep) => rep.launch?.status === 'measured')
      ? stats(run.repetitions.map((rep) => rep.launch.value))
      : unavailable('No todos los lanzamientos tienen TotalTime válido.'),
    jankPercent: graphics.every((point) => point.status === 'measured')
      ? stats(graphics.map((point) => point.value.jankPercent))
      : unavailable('Contadores gráficos incompletos.'),
    slowPercent: graphics.every(
      (point) => point.status === 'measured' && point.value.slowPercent.status === 'measured',
    )
      ? stats(graphics.map((point) => point.value.slowPercent.value))
      : unavailable('Cobertura de tiempos incompleta.'),
    frozenFrames: graphics.every(
      (point) => point.status === 'measured' && point.value.frozenFrames.status === 'measured',
    )
      ? stats(graphics.map((point) => point.value.frozenFrames.value))
      : unavailable('Cobertura de tiempos incompleta.'),
    memoryTrend:
      finals.length >= 3 && finals.length === final.length
        ? {
            status: 'review-required',
            finalPssKb: finals,
            deltaFirstLastKb: finals.at(-1) - finals[0],
            strictlyIncreasing: finals.every(
              (value, index) => index === 0 || value > finals[index - 1],
            ),
            reason:
              'Puntos finales estabilizados; crecimiento puede ser caché, GC diferido o actividad distinta. No demuestra fuga.',
          }
        : unavailable('Se requieren >=3 puntos finales estabilizados válidos.'),
  };
}
function compare(baseline, candidate) {
  const keys = [
    'device',
    'android',
    'sdk',
    'model',
    'fingerprint',
    'hardware',
    'abi',
    'memTotalKb',
    'displaySize',
    'displayDensity',
    'appId',
    'build',
    'conditions',
    'scenario',
    'durationSeconds',
    'intervalSeconds',
    'settleSeconds',
    'repeat',
    'launch',
    'protocolVersion',
  ];
  const incompatible = keys.filter(
    (key) => JSON.stringify(baseline.metadata[key]) !== JSON.stringify(candidate.metadata[key]),
  );
  const valid = (run) =>
    run.schemaVersion === 1 &&
    keys.every((key) => run.metadata[key] !== undefined && run.metadata[key] !== null) &&
    [1, 2, 3].includes(run.metadata.protocolVersion) &&
    run.metadata.build.representative === true &&
    run.status === 'captured' &&
    run.repetitions.length >= 3 &&
    run.repetitions.length === run.metadata.repeat &&
    run.repetitions.every(
      (rep) =>
        rep.status === 'captured' &&
        rep.observation === 'completed' &&
        rep.memory.length >= 2 &&
        rep.memory.at(-1).phase === 'settled' &&
        rep.memory.every(
          (sample) =>
            sample.pssKb.status === 'measured' &&
            Number.isFinite(sample.pssKb.value) &&
            sample.pssKb.value >= 0,
        ),
    );
  if (incompatible.length || !valid(baseline) || !valid(candidate))
    return {
      status: 'not-comparable',
      incompatible,
      reason: 'Exige condiciones idénticas y >=3 recorridos completos con memoria válida.',
    };
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const endPss = (run) => mean(run.repetitions.map((rep) => rep.memory.at(-1).pssKb.value));
  const before = endPss(baseline);
  const after = endPss(candidate);
  return {
    status: 'compared',
    baselineSummary: summarize(baseline),
    candidateSummary: summarize(candidate),
    baselineMeanFinalPssKb: before,
    candidateMeanFinalPssKb: after,
    deltaPssKb: after - before,
    deltaPercent:
      before > 0 ? measured((100 * (after - before)) / before) : unavailable('Baseline cero.'),
    verdict: objectives(candidate),
    memoryTrend: unavailable('Revisar puntos estabilizados y ciclos; delta no demuestra una fuga.'),
  };
}
module.exports = {
  unavailable,
  measured,
  integer,
  memory,
  graphics,
  graphicsStructure,
  launch,
  launchDiagnostics,
  build,
  deviceState,
  frameSummary,
  objectives,
  summarize,
  compare,
};
