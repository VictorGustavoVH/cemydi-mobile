// Manual one-shot structural inspection; never launches, stops or resets the app.
const { spawnSync } = require('node:child_process');
const { graphics, deviceState } = require('./metrics.cjs');
const { offline } = require('./cli.cjs');

function execute(args) {
  const result = spawnSync(process.env.CEMYDI_ADB || 'adb', args, {
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0)
    throw new Error('Inspección ADB fallida; stderr y dump omitidos por privacidad.');
  return result.stdout.trim();
}
function inspect(serial, run = execute) {
  if (!serial || !/^[\w.:-]+$/.test(serial)) throw new Error('Especificar serial ADB válido.');
  deviceState(run(['devices']), serial);
  const adb = (args) => run(['-s', serial, ...args]);
  offline(adb);
  // The unfiltered report exists only in process memory, never stdout or a file.
  const parsed = graphics(adb(['shell', 'dumpsys', 'gfxinfo', 'com.cemydi.app', 'framestats']));
  return {
    schemaVersion: 1,
    kind: 'gfxinfo-structure-only',
    at: new Date().toISOString(),
    counters: parsed.counters,
    diagnostics: parsed.diagnostics,
    limitation:
      'Inspección puntual; puede validar ventana única por estructura, pero no mide variaciones ni certifica continuidad o cobertura.',
  };
}
function main(args = process.argv.slice(2)) {
  if (args.length !== 2 || args[0] !== '--device')
    throw new Error('Uso: node scripts/performance/inspect-gfxinfo.cjs --device SERIAL');
  const report = inspect(args[1]);
  console.log(JSON.stringify(report, null, 2));
  if (
    report.diagnostics.processSections !== 1 ||
    report.diagnostics.totalMatches === 0 ||
    report.diagnostics.jankyMatches === 0
  )
    throw new Error('Reporte sin proceso único o sin contadores reconocidos; formato no validado.');
}
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { inspect };
