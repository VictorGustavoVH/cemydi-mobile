/* global __dirname */
const path = require('node:path');
const { runProfile } = require('./runner.cjs');
const { createEvidenceDirectory, metadata, writeReports } = require('./reports.cjs');

async function main(args = process.argv.slice(2)) {
  if (args.length) throw new Error('Este arnés no acepta argumentos ni destinos configurables.');
  const directory = await createEvidenceDirectory(
    path.resolve(__dirname, '../../test-results/load'),
  );
  const info = metadata();
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  try {
    console.log(`Evidencias: ${directory}`);
    const result = await runProfile({
      signal: controller.signal,
      onPhase: (name) => console.log(`Fase: ${name}`),
    });
    await writeReports(directory, result, info);
    console.log(`Resultado: ${result.status}${result.reason ? ` (${result.reason})` : ''}`);
    process.exitCode =
      result.status === 'passed' ? 0 : result.reason === 'MANUAL_INTERRUPTION' ? 130 : 1;
    return { directory, result };
  } finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
}

if (require.main === module) {
  main().catch(() => {
    console.error('No se pudo iniciar o guardar la ejecución de carga local.');
    process.exitCode = 1;
  });
}

module.exports = { main };
