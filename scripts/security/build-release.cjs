const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { securitySettings } = require('../../plugins/with-android-security.cjs');

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--aab')) {
  throw new Error('Uso: node scripts/security/build-release.cjs [--aab]');
}
const releaseTask = args[0] === '--aab' ? ':app:bundleRelease' : ':app:assembleRelease';
const gradleArgs = [releaseTask, '--max-workers=2', '--stacktrace'];

// Load local environment without printing it; Expo performs the same dotenv load.
require('@expo/env').load(process.cwd(), { silent: true });
const confirmed = require('../../config/android-api.json');
const environment = {
  ...process.env,
  EXPO_PUBLIC_APP_ENV: 'production',
  EXPO_UNSTABLE_HEADLESS: '1',
  EXPO_PUBLIC_API_URL: process.env.CEMYDI_RELEASE_API_URL || confirmed.apiOrigin,
};
securitySettings(environment);
const signing = JSON.parse(readFileSync(path.resolve('.credentials/signing.json'), 'utf8'));
Object.assign(environment, {
  CEMYDI_RELEASE_STORE_FILE: signing.keystore,
  CEMYDI_RELEASE_STORE_PASSWORD: signing.storePassword,
  CEMYDI_RELEASE_KEY_ALIAS: signing.keyAlias,
  CEMYDI_RELEASE_KEY_PASSWORD: signing.keyPassword,
});
// Regenerate through CNG. No native projects are hand edited.
execFileSync(
  process.execPath,
  [require.resolve('expo/bin/cli'), 'prebuild', '--platform', 'android', '--no-install'],
  { env: environment, stdio: 'inherit' },
);
const wrapper = path.resolve('android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
if (process.platform === 'win32') {
  execFileSync('cmd.exe', ['/d', '/c', 'gradlew.bat', ...gradleArgs], {
    cwd: path.resolve('android'),
    env: environment,
    stdio: 'inherit',
  });
} else {
  execFileSync(wrapper, gradleArgs, {
    cwd: path.resolve('android'),
    env: environment,
    stdio: 'inherit',
  });
}
