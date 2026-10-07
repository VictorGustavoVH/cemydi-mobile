const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

// Use the official distribution's entry point directly, including on Windows.
// CLI arguments are passed to Java without an intermediate shell.
const toolHome = process.env.CEMYDI_MAESTRO_HOME || path.resolve('.tools/maestro/maestro');
const classpath = path.join(toolHome, 'lib', '*');

if (!existsSync(path.join(toolHome, 'lib'))) {
  console.error('Instala Maestro según docs/TESTING.md o configura CEMYDI_MAESTRO_HOME.');
  process.exit(1);
}

const java = process.env.JAVA_HOME
  ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
  : 'java';

const result = spawnSync(
  java,
  [
    '--enable-native-access=ALL-UNNAMED',
    '-classpath',
    classpath,
    'maestro.cli.AppKt',
    ...process.argv.slice(2),
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      MAESTRO_CLI_NO_ANALYTICS: '1',
      MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
    },
  },
);

if (result.error) {
  console.error(
    `No se pudo ejecutar Maestro: ${result.error.message}. Requiere Java 17 o superior.`,
  );
}
process.exit(result.status ?? 1);
