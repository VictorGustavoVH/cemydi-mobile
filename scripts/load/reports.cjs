/* global __dirname */
const { mkdir, mkdtemp, writeFile } = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { PROTOCOL, PHASES, LIMITS, TIMEOUT_MS, PATHS } = require('./protocol.cjs');

async function createEvidenceDirectory(root) {
  await mkdir(root, { recursive: true });
  return mkdtemp(path.join(root, `${new Date().toISOString().replace(/[:.]/g, '-')}-`));
}

function metadata() {
  return {
    protocol: PROTOCOL,
    createdAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      cpuCount: os.availableParallelism(),
    },
    configuration: {
      phases: PHASES,
      limits: LIMITS,
      timeoutMs: TIMEOUT_MS,
      normalFaultDelayMs: 200,
      bind: '127.0.0.1',
      port: 'ephemeral, owned server only',
      method: 'GET',
      paths: PATHS,
      retries: 0,
      redirects: 'reject',
      faultSchedule: { http503: [1, 2], timeout: [3, 4], recovery: 20 },
      percentiles: 'linear interpolation at (n - 1) * p; all terminal outcomes',
    },
    sources: Object.fromEntries(
      [
        '../maestro-api.cjs',
        'protocol.cjs',
        'local-session.cjs',
        'runner.cjs',
        'metrics.cjs',
        'reports.cjs',
        'cli.cjs',
      ].map((file) => [
        file,
        createHash('sha256')
          .update(readFileSync(path.join(__dirname, file)))
          .digest('hex'),
      ]),
    ),
  };
}

async function writeReports(directory, result, info) {
  const columns = [
    'id',
    'phase',
    'phaseIndex',
    'method',
    'path',
    'fault',
    'recovery',
    'offsetMs',
    'kind',
    'status',
    'bytes',
    'durationMs',
    'expected',
  ];
  const csv = [
    columns.join(','),
    ...result.requests.map((record) =>
      columns.map((key) => JSON.stringify(record[key] ?? '')).join(','),
    ),
  ].join('\n');
  const number = (value) => (value === null ? 'n/a' : value.toFixed(2));
  const summary = [
    '# CEMYDI — carga HTTP local',
    '',
    `Protocolo: ${info.protocol}. Fecha UTC: ${info.createdAt}.`,
    '',
    `Estado: **${result.status}**. Motivo de detención: ${result.reason ?? 'ninguno'}.`,
    `Planificadas: ${result.planned}. Iniciadas: ${result.started}. Completadas: ${result.completed}.`,
    `Duración: ${number(result.durationMs)} ms. Concurrencia máxima: ${result.maxConcurrency}.`,
    '',
    '| Fase | Plan | Inicio | Fin | Éxito | HTTP | Transporte | Timeout | Canceladas | Esperados | Inesperados | Concurrencia | Min ms | Mediana ms | p95 ms | Max ms | Duración ms | req/s | Estado |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...result.phases.map(
      (phase) =>
        `| ${[
          phase.name,
          phase.planned,
          phase.started,
          phase.completed,
          phase.successful,
          phase.httpErrors,
          phase.transportFailures,
          phase.timeouts,
          phase.cancelled,
          phase.expectedErrors,
          phase.unexpectedErrors,
          phase.maxConcurrency,
          ...Object.values(phase.latencyMs).map(number),
          number(phase.durationMs),
          number(phase.requestsPerSecond),
          phase.status,
        ].join(' | ')} |`,
    ),
    '',
    ...result.phases.map(
      (phase) =>
        `- ${phase.name}: ${Object.entries(phase.criteria)
          .map(([key, value]) => `${key}=${value}`)
          .join(', ')}.`,
    ),
    '',
    'Completadas = resultados terminales, incluidos timeouts y cancelaciones. Latencias incluyen el consumo completo del body para respuestas HTTP; timeout/cancelación mide hasta su terminación.',
    'Los fallos esperados solo aprueban si coinciden con su solicitud programada. La comprobación de recuperación usa la última solicitud de la fase faults dentro del máximo de 180.',
    'Este resultado mide un fixture local; no demuestra capacidad, seguridad ni rendimiento del backend real o de Android/iOS.',
    '',
  ].join('\n');
  await Promise.all([
    writeFile(path.join(directory, 'summary.md'), summary),
    writeFile(path.join(directory, 'results.json'), `${JSON.stringify(result, null, 2)}\n`),
    writeFile(path.join(directory, 'requests.csv'), `${csv}\n`),
    writeFile(path.join(directory, 'metadata.json'), `${JSON.stringify(info, null, 2)}\n`),
  ]);
}

module.exports = { createEvidenceDirectory, metadata, writeReports };
