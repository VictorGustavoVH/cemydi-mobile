const { execFileSync } = require('node:child_process');
const { appendFileSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

// Only paths proven to be outside the app/Maestro runtime may skip Android.
// Unknown paths run the full chain, including renamed/deleted runtime files.
function affectsAndroid(file) {
  if (/^(docs\/|\.github\/ISSUE_TEMPLATE\/)/.test(file)) return false;
  if (/^[^/]+\.(md|mdx|txt|rst)$/i.test(file)) return false;
  if (/^(tests\/|scripts\/(load|performance)\/)/.test(file)) return false;
  if (/^src\/.*(?:\/__tests__\/|\.(?:test|spec)\.[^/]+$)/.test(file)) return false;
  if (
    [
      '.github/pull_request_template.md',
      '.github/workflows/quality.yml',
      '.prettierignore',
      '.prettierrc',
      'eslint.config.js',
      'jest.config.js',
      'jest.env.js',
      'jest.setup.ts',
      'scripts/test-summary.cjs',
    ].includes(file)
  )
    return false;
  return true;
}

function selectAndroid(files, { eventName, force = false } = {}) {
  if (eventName === 'workflow_dispatch' || force)
    return { required: true, reason: 'Ejecución Android completa solicitada.', relevant: files };
  const relevant = files.filter(affectsAndroid);
  return {
    required: relevant.length > 0,
    reason: relevant.length
      ? 'Hay cambios de app, Maestro o configuración.'
      : 'Solo verificaciones rápidas.',
    relevant,
  };
}

function changedFiles(eventName, event, git = (args) => execFileSync('git', args)) {
  const base = eventName === 'pull_request' ? event.pull_request?.base?.sha : event.before;
  const head = process.env.GITHUB_SHA;
  if (eventName === 'push' && /^0{40}$/.test(base || '')) return null;
  if (!['pull_request', 'push'].includes(eventName))
    throw new Error(`Evento no soportado para calcular cambios: ${eventName}.`);
  if (![base, head].every((sha) => /^[a-f0-9]{40}$/i.test(sha || '')))
    throw new Error('Faltan revisiones válidas: no se permite omitir Android por defecto.');
  // PR checkout is the merge commit: compare its tree with that event's base.
  // --no-renames reports both the old and new paths, preventing unsafe skips.
  return git(['diff', '--name-only', '--no-renames', '-z', base, head, '--'])
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

function evaluateResult(needs) {
  const failures = [];
  const fast = ['changes', 'tests', 'maestro_checks'];
  const required = needs?.changes?.outputs?.android_required;
  if (!['true', 'false'].includes(required)) failures.push('Decisión Android ausente o inválida.');
  for (const job of fast)
    if (needs?.[job]?.result !== 'success') failures.push(`${job}: se exige success.`);
  const expected = required === 'false' ? 'skipped' : 'success';
  for (const job of ['build_android', 'maestro'])
    if (needs?.[job]?.result !== expected) failures.push(`${job}: se exige ${expected}.`);
  return { passed: failures.length === 0, androidRequired: required, failures };
}

function saveReport(name, report) {
  const directory = path.resolve('test-results/ci');
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, `${name}.json`),
    JSON.stringify(
      { commit: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, ...report },
      null,
      2,
    ),
  );
}

function main() {
  if (process.argv[2] === 'select') {
    const eventName = process.env.GITHUB_EVENT_NAME;
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const force = event.pull_request?.labels?.some((label) => label.name === 'ci:android');
    const files = eventName === 'workflow_dispatch' || force ? [] : changedFiles(eventName, event);
    const report =
      files === null
        ? { required: true, reason: 'Primer push: validar Android completo.', relevant: [] }
        : selectAndroid(files, { eventName, force });
    saveReport('android-selection', { ...report, changed: files });
    if (!process.env.GITHUB_OUTPUT) throw new Error('Falta GITHUB_OUTPUT.');
    appendFileSync(process.env.GITHUB_OUTPUT, `android_required=${report.required}\n`);
    console.log(`Android requerido: ${report.required}. ${report.reason}`);
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `Android requerido: **${report.required}**. ${report.reason}\n`,
      );
  } else if (process.argv[2] === 'result') {
    const needs = JSON.parse(process.env.JOB_RESULTS);
    const report = evaluateResult(needs);
    saveReport('result', { ...report, needs });
    for (const [name, job] of Object.entries(needs)) console.log(`${name}: ${job.result}`);
    for (const failure of report.failures) console.error(failure);
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `E2E: **${report.passed ? 'aprobado' : 'fallido'}**. Android requerido: ${report.androidRequired}.\n`,
      );
    if (!report.passed) process.exitCode = 1;
  } else throw new Error('Uso: node scripts/ci/android-policy.cjs <select|result>.');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { affectsAndroid, selectAndroid, changedFiles, evaluateResult };
