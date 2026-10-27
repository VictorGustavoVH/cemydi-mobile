const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  rmSync,
  rmdirSync,
  writeFileSync,
  appendFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { checkSast } = require('./policy.cjs');
const tools = require('./tools.json');

const root = path.dirname(require.resolve('../../package.json'));
const output = path.join(root, 'test-results/security/sast');
const environment = {
  ...process.env,
  SEMGREP_SEND_METRICS: 'off',
  SEMGREP_ENABLE_VERSION_CHECK: '0',
  PYTHONUTF8: '1',
};

function invoke(executable, args, timeout = 600_000) {
  const env = { ...environment };
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') || 'PATH';
  if (executable.includes('/') || executable.includes('\\'))
    env[pathKey] =
      `${path.dirname(path.resolve(executable))}${path.delimiter}${env[pathKey] || ''}`;
  return spawnSync(executable, args, {
    cwd: root,
    env,
    encoding: 'utf8',
    timeout,
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
  });
}

function sourceTargets() {
  return [
    'src',
    'scripts',
    'plugins',
    ...readdirSync(root).filter(
      (name) => /\.(?:[cm]?js|json)$/.test(name) && name !== 'package-lock.json',
    ),
  ];
}

function sourceFiles() {
  const files = [];
  function visit(file) {
    if (statSync(file).isDirectory()) {
      for (const entry of readdirSync(file)) visit(path.join(file, entry));
    } else if (/\.(?:[cm]?js|jsx|tsx?|json)$/.test(file)) {
      files.push(path.relative(root, file).replaceAll('\\', '/'));
    }
  }
  for (const target of sourceTargets()) visit(path.join(root, target));
  return files;
}

function verifyRuleFixtures(source, report) {
  if (report?.version !== tools.semgrep || report.errors?.length || !Array.isArray(report.results))
    throw new Error('Semgrep no pudo analizar los casos de reglas.');
  const expected = source
    .split(/\r?\n/)
    .flatMap((line, index) => {
      const annotation = line.match(/^\/\/ ruleid: (\S+)$/);
      return annotation ? [`${annotation[1]}:${index + 2}`] : [];
    })
    .sort();
  const actual = report.results.map((item) => `${item.check_id}:${item.start.line}`).sort();
  if (!expected.length || JSON.stringify(expected) !== JSON.stringify(actual))
    throw new Error(
      `Reglas: esperados ${JSON.stringify(expected)}; observados ${JSON.stringify(actual)}.`,
    );
  return expected.length;
}

function save(report) {
  mkdirSync(output, { recursive: true });
  writeFileSync(path.join(output, 'semgrep.json'), JSON.stringify(report, null, 2));
  const lines = [
    '# SAST móvil — Semgrep CE',
    `Estado: ${report.passed ? 'APROBADO según las reglas seleccionadas' : 'FALLO'}.`,
    'DAST del backend: PENDIENTE de entorno aislado autorizado. Este resultado no acredita ambos análisis.',
    'Los hallazgos son candidatos pendientes de revisión, no vulnerabilidades confirmadas automáticamente.',
    ...(report.error ? [report.error] : []),
    ...(report.findings ?? []).map(
      (item) =>
        `${item.risk} ${item.rule} ${item.path}:${item.line} — ${item.message} [pending-review]`,
    ),
  ].join('\n');
  writeFileSync(path.join(output, 'summary.txt'), `${lines}\n`);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines}\n`);
  console.log(lines);
  if (report.findings) {
    const ids = [...new Set(report.findings.map((item) => item.rule))];
    const sarif = {
      version: '2.1.0',
      $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
      runs: [
        {
          tool: {
            driver: {
              name: 'Semgrep CE — CEMYDI policy',
              version: tools.semgrep,
              rules: ids.map((id) => ({ id })),
            },
          },
          results: report.findings.map((item) => ({
            ruleId: item.rule,
            level:
              item.severity === 'ERROR'
                ? 'error'
                : item.severity === 'WARNING'
                  ? 'warning'
                  : 'note',
            message: { text: item.message },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: item.path.replaceAll('\\', '/') },
                  region: { startLine: item.line },
                },
              },
            ],
            properties: { risk: item.risk, triage: item.triage },
          })),
        },
      ],
    };
    writeFileSync(path.join(output, 'semgrep.sarif'), JSON.stringify(sarif, null, 2));
  }
}

function main(args = process.argv.slice(2)) {
  mkdirSync(output, { recursive: true });
  for (const name of ['semgrep.json', 'semgrep.sarif', 'summary.txt'])
    rmSync(path.join(output, name), { force: true });
  const testRules = args[0] === '--test-rules';
  if (testRules) args = args.slice(1);
  if (args.length && (args.length !== 2 || args[0] !== '--semgrep'))
    throw new Error('Uso: sast.cjs [--test-rules] [--semgrep ejecutable]');
  const executable = args[1] || 'semgrep';
  const version = invoke(executable, ['--version'], 60_000);
  if (version.error || version.status !== 0 || version.stdout.trim() !== tools.semgrep)
    throw new Error(`Se requiere Semgrep CE ${tools.semgrep}; verifica la instalación aislada.`);
  const temporary = mkdtempSync(path.join(tmpdir(), 'cemydi-semgrep-'));
  const raw = path.join(temporary, 'raw.json');
  const fixture = path.join(temporary, 'mobile.tsx');
  const testConfig = path.join(temporary, 'mobile.yml');
  try {
    if (testRules) {
      copyFileSync(path.join(root, '.semgrep/tests/mobile.tsx.txt'), fixture);
      copyFileSync(path.join(root, '.semgrep/mobile.yml'), testConfig);
      const result = invoke(executable, [
        'scan',
        '--oss-only',
        '--config',
        testConfig,
        '--no-rewrite-rule-ids',
        '--metrics',
        'off',
        '--disable-nosem',
        '--no-git-ignore',
        '--json-output',
        raw,
        fixture,
      ]);
      if (result.error || result.status !== 0 || !existsSync(raw)) {
        if (result.stderr) console.error(result.stderr);
        throw new Error('Las pruebas reales de reglas Semgrep fallaron.');
      }
      const count = verifyRuleFixtures(
        readFileSync(fixture, 'utf8'),
        JSON.parse(readFileSync(raw, 'utf8')),
      );
      console.log(
        `${count} reglas verificadas con Semgrep real, incluidos los controles negativos.`,
      );
      return 0;
    }
    const result = invoke(executable, [
      'scan',
      '--oss-only',
      '--config',
      '.semgrep/mobile.yml',
      '--metrics',
      'off',
      '--disable-version-check',
      '--disable-nosem',
      '--no-rewrite-rule-ids',
      '--strict',
      '--json-output',
      raw,
      ...sourceTargets(),
    ]);
    if (result.error || !existsSync(raw))
      throw new Error('Semgrep no generó resultados; no se considera un análisis aprobado.');
    const report = checkSast(JSON.parse(readFileSync(raw, 'utf8')), result.status);
    const scanned = new Set(report.scanned);
    const missing = sourceFiles().filter((file) => !scanned.has(file));
    if (missing.length)
      throw new Error('Semgrep omitió archivos de código/configuración: ' + missing.join(', '));
    report.ruleSetSha256 = createHash('sha256')
      .update(readFileSync(path.join(root, '.semgrep/mobile.yml')))
      .digest('hex');
    report.revision = {
      checkout: process.env.GITHUB_SHA ?? null,
      head: process.env.SECURITY_HEAD_SHA ?? null,
      runId: process.env.GITHUB_RUN_ID ?? null,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    };
    save(report);
    return report.passed ? 0 : 1;
  } finally {
    // Solo se eliminan los dos archivos exactos creados por esta ejecución, sin borrado recursivo.
    if (existsSync(raw)) rmSync(raw);
    if (existsSync(fixture)) rmSync(fixture);
    if (existsSync(testConfig)) rmSync(testConfig);
    rmdirSync(temporary);
  }
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    save({
      passed: false,
      scope: 'mobile-source',
      error: error.message,
      backendDast: 'pending-authorized-isolated-backend',
    });
    process.exitCode = 2;
  }
}

module.exports = { sourceTargets, sourceFiles, verifyRuleFixtures };
