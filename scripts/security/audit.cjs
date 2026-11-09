const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const severities = ['info', 'low', 'moderate', 'high', 'critical'];

function checkDependencyAudit(report, exitCode) {
  if (![0, 1].includes(exitCode) || report?.error || report?.auditReportVersion !== 2)
    throw new Error('npm audit no completó un reporte válido.');
  if (
    !report.vulnerabilities ||
    typeof report.vulnerabilities !== 'object' ||
    Array.isArray(report.vulnerabilities)
  )
    throw new Error('Falta el inventario de vulnerabilidades de npm audit.');
  const counts = report.metadata?.vulnerabilities;
  if (
    !counts ||
    ![...severities, 'total'].every((key) => Number.isSafeInteger(counts[key]) && counts[key] >= 0)
  )
    throw new Error('Conteos de npm audit ausentes o inválidos.');
  const findings = Object.entries(report.vulnerabilities).map(([name, item]) => {
    if (item?.name !== name || !severities.includes(item.severity) || !Array.isArray(item.via))
      throw new Error('Vulnerabilidad de npm audit incompatible.');
    return { name, severity: item.severity };
  });
  if (
    findings.length !== counts.total ||
    severities.some(
      (severity) =>
        findings.filter((item) => item.severity === severity).length !== counts[severity],
    ) ||
    (exitCode === 0) !== (counts.total === 0)
  )
    throw new Error('El resultado de npm audit tiene conteos o salida inconsistentes.');
  // Keep every finding visible. Tooling is included; there are no advisory exceptions.
  return { passed: counts.high === 0 && counts.critical === 0, counts, findings };
}

function main() {
  const root = path.dirname(require.resolve('../../package.json'));
  const directory = path.join(root, 'test-results/security/dependencies');
  mkdirSync(directory, { recursive: true });
  // A failed run must not leave an approval from an earlier successful audit.
  for (const name of ['npm-audit.json', 'policy.json', 'summary.txt']) {
    require('node:fs').rmSync(path.join(directory, name), { force: true });
  }
  if (!process.env.npm_execpath)
    throw new Error('Ejecuta esta auditoría con npm run security:audit.');
  const result = spawnSync(
    process.execPath,
    [process.env.npm_execpath, 'audit', '--json', '--include=dev', '--audit-level=info'],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
    },
  );
  if (result.error) throw new Error(`No se pudo ejecutar npm audit: ${result.error.code}.`);
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error('npm audit no devolvió JSON legible.');
  }
  writeFileSync(path.join(directory, 'npm-audit.json'), JSON.stringify(report, null, 2));
  const policy = checkDependencyAudit(report, result.status);
  const evidence = {
    ...policy,
    scope: 'all-npm-dependencies-including-tooling',
    lockfileSha256: createHash('sha256')
      .update(readFileSync(path.join(root, 'package-lock.json')))
      .digest('hex'),
    checkedAt: new Date().toISOString(),
    node: process.version,
  };
  writeFileSync(path.join(directory, 'policy.json'), JSON.stringify(evidence, null, 2));
  const summary = [
    `Auditoría npm: ${policy.passed ? 'APROBADA' : 'BLOQUEADA'} (HIGH/CRITICAL).`,
    `Conteos completos: ${JSON.stringify(policy.counts)}`,
    ...policy.findings.map((item) => `${item.severity}: ${item.name}`),
    'Las entradas incluyen propagaciones y herramientas; no equivalen a ataques demostrados en el APK.',
  ].join('\n');
  writeFileSync(path.join(directory, 'summary.txt'), summary + '\n');
  console.log(summary);
  if (!policy.passed) process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { checkDependencyAudit };
