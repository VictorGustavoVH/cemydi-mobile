const { spawnSync } = require('node:child_process');

// Prefab launches its own JVM. JDK 24+ emits a JNI warning that Android's
// Prefab stderr parser treats as fatal, so propagate native access to that JVM.
const currentOptions = process.env.JAVA_TOOL_OPTIONS || '';
const existingAccess = currentOptions.match(/--enable-native-access=([^\s]+)/);
const modules = new Set(existingAccess ? existingAccess[1].split(',') : []);
modules.add('ALL-UNNAMED');
const accessOption = `--enable-native-access=${[...modules].join(',')}`;
const javaOptions = existingAccess
  ? currentOptions.replace(existingAccess[0], accessOption)
  : `${currentOptions} ${accessOption}`.trim();

const result = spawnSync(
  process.execPath,
  [require.resolve('expo/bin/cli'), 'run:android', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: { ...process.env, JAVA_TOOL_OPTIONS: javaOptions },
  },
);

if (result.error) {
  console.error(`No se pudo iniciar la compilación Android: ${result.error.message}`);
}
process.exit(result.status ?? 1);
