const { fixtureTarget, semgrep, zap } = require('./tools.json');

function checkSast(report, exitCode) {
  if (exitCode !== 0) {
    const errors = (report?.errors ?? []).map(
      (error) => `${error.type ?? 'error'}:${error.path ?? error.location?.path ?? 'sin ruta'}`,
    );
    throw new Error(`Semgrep no completó el análisis: salida ${exitCode}. ${errors.join('; ')}`);
  }
  if (
    report?.version !== semgrep ||
    !Array.isArray(report.results) ||
    !Array.isArray(report.errors)
  )
    throw new Error('Resultado Semgrep ausente, incompatible o de otra versión.');
  if (report.errors.length) throw new Error('Semgrep informa errores: el análisis es incompleto.');
  const scanned = report.paths?.scanned;
  if (
    !Array.isArray(scanned) ||
    !['src/', 'scripts/'].every((prefix) =>
      scanned.some((file) => file.replaceAll('\\', '/').startsWith(prefix)),
    )
  )
    throw new Error('Semgrep no acredita análisis de src/ y scripts/.');
  const findings = report.results.map((item) => {
    const severity = item.extra?.severity;
    const risk = item.extra?.metadata?.['cemydi-risk'];
    if (
      !['ERROR', 'WARNING', 'INFO'].includes(severity) ||
      !['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(risk)
    )
      throw new Error('Severidad Semgrep desconocida o sin política explícita.');
    if (severity === 'ERROR' && !['HIGH', 'CRITICAL'].includes(risk))
      throw new Error('Una regla ERROR no puede rebajarse por debajo de HIGH.');
    if (!item.check_id || !item.path || !Number.isInteger(item.start?.line))
      throw new Error('Hallazgo Semgrep sin ubicación verificable.');
    // No copiar snippets, metavariables ni contenido que pudiera incluir credenciales.
    return {
      rule: item.check_id,
      path: item.path,
      line: item.start.line,
      severity,
      risk,
      message: item.extra.message,
      triage: 'pending-review',
    };
  });
  return {
    tool: `Semgrep CE ${semgrep}`,
    scope: 'mobile-source',
    passed: !findings.some((item) => ['HIGH', 'CRITICAL'].includes(item.risk)),
    scannedFiles: scanned.length,
    scanned: scanned.map((file) => file.replaceAll('\\', '/')),
    findings,
    backendDast: 'pending-authorized-isolated-backend',
  };
}

function checkZap(report, exitCode) {
  if (![0, 1, 2].includes(exitCode))
    throw new Error(`ZAP Baseline no completó: salida ${exitCode}.`);
  if (report?.['@version'] !== zap || !Array.isArray(report.site) || !report.site.length)
    throw new Error('Reporte ZAP ausente, incompatible o sin sitio analizado.');
  const target = new URL(fixtureTarget);
  const findings = [];
  for (const site of report.site) {
    if (new URL(site['@name']).origin !== target.origin || !Array.isArray(site.alerts))
      throw new Error('ZAP reporta un objetivo fuera del fixture o un resultado inválido.');
    for (const alert of site.alerts) {
      const risk = Number(alert.riskcode);
      if (!/^[0-3]$/.test(String(alert.riskcode)) || !Array.isArray(alert.instances))
        throw new Error('Alerta ZAP sin severidad o instancias válidas.');
      for (const instance of alert.instances) {
        const url = new URL(instance.uri);
        if (
          url.origin !== target.origin ||
          url.search ||
          !['/', '/health', '/fixture', '/robots.txt', '/sitemap.xml'].includes(url.pathname)
        )
          throw new Error('ZAP informa una URL fuera de alcance.');
      }
      findings.push({
        rule: alert.pluginid,
        risk,
        riskDescription: alert.riskdesc,
        name: alert.name,
        instances: alert.instances.length,
        triage: 'pending-review',
      });
    }
  }
  return {
    tool: `ZAP Baseline ${zap}`,
    scope: 'fixture-only-not-cemydi-backend',
    backendDast: 'pending-authorized-isolated-backend',
    passed: exitCode !== 1 && !findings.some((item) => item.risk >= 3),
    findings,
  };
}

module.exports = { checkSast, checkZap };
