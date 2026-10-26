const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, mkdtempSync, writeFileSync, unlinkSync, rmdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const m = require('./metrics.cjs');
const { options, bounded, conditions, offline, capture, main } = require('./cli.cjs');
const { inspect } = require('./inspect-gfxinfo.cjs');

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
