/* global __dirname */
const { appendFileSync, existsSync, readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const [suite, outcome = 'local'] = process.argv.slice(2);
if (!['unit', 'integration'].includes(suite)) {
  console.error('Uso: node scripts/test-summary.cjs <unit|integration> [outcome]');
  process.exit(1);
}

const directory = path.resolve(__dirname, '..', 'test-results', 'jest', suite);
const lines = [`## Jest: ${suite}`, '', `Estado del paso: **${outcome}**.`, ''];
const escape = (value) =>
  String(value).replace(/[&<>|\r\n]/g, (char) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '|': '&#124;', '\r': ' ', '\n': ' ' }[char];
  });

try {
  const results = JSON.parse(readFileSync(path.join(directory, 'results.json'), 'utf8'));
  const counts = [
    results.numTotalTestSuites,
    results.numPassedTestSuites,
    results.numFailedTestSuites,
    results.numPendingTestSuites,
    results.numTotalTests,
    results.numPassedTests,
    results.numFailedTests,
    results.numPendingTests,
    results.numTodoTests,
  ];
  if (!counts.every((count) => Number.isInteger(count) && count >= 0)) {
    throw new Error('El JSON no contiene los contadores esperados de Jest.');
  }
  if (!existsSync(path.join(directory, 'junit.xml'))) {
    throw new Error('No se generó junit.xml.');
  }
  lines.push(
    `Resultado de Jest: **${results.success ? 'aprobado' : 'fallido'}**.`,
    '',
    '| Tipo | Total | Aprobadas | Fallidas | Pendientes | Todo |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    `| Suites | ${counts[0]} | ${counts[1]} | ${counts[2]} | ${counts[3]} | — |`,
    `| Pruebas | ${counts[4]} | ${counts[5]} | ${counts[6]} | ${counts[7]} | ${counts[8]} |`,
    '',
  );
  const failures = results.testResults.filter((result) => result.status === 'failed');
  if (failures.length) {
    lines.push('### Archivos con fallos', '');
    for (const result of failures.slice(0, 10)) {
      lines.push(`- ${escape(path.relative(process.cwd(), result.name))}`);
    }
    lines.push(
      '',
      'Consultar los mensajes completos en results.json, junit.xml y el log del paso.',
      '',
    );
  }
  // A successful summary must never turn a failing Jest invocation into success.
  if (!results.success || outcome === 'failure' || counts[4] === 0) process.exitCode = 1;
} catch (error) {
  lines.push(`**Sin evidencia completa de Jest:** ${escape(error.message)}`, '');
  lines.push(
    'Revisar instalación, configuración y log del paso; esto no equivale a pruebas aprobadas.',
    '',
  );
  // Skipped/cancelled tests can occur before Jest starts; the original job state remains intact.
  process.exitCode = ['skipped', 'cancelled'].includes(outcome) ? 0 : 1;
}

lines.push(`Evidencias: test-results/jest/${suite}/. Retención en Actions: 14 días.`, '');
const summary = lines.join('\n');
mkdirSync(directory, { recursive: true });
writeFileSync(path.join(directory, 'summary.md'), summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(summary);
