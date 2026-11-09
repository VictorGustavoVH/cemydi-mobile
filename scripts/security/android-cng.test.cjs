/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, readFileSync, writeFileSync, symlinkSync } = require('node:fs');
const path = require('node:path');

test('Expo 57 CNG generates system TLS policy and migrates the previous native pinning blocks', () => {
  const root = path.resolve(__dirname, '../..');
  const evidence = path.join(root, 'test-results/security/system-tls-cng');
  mkdirSync(evidence, { recursive: true });
  const project = mkdtempSync(path.join(evidence, 'project-'));
  const dependencies = require('../../package.json').dependencies;
  writeFileSync(
    path.join(project, 'package.json'),
    JSON.stringify({
      name: 'cemydi-tls-cng-check',
      version: '1.0.0',
      private: true,
      dependencies: {
        expo: dependencies.expo,
        react: dependencies.react,
        'react-native': dependencies['react-native'],
      },
    }),
  );
  symlinkSync(path.join(root, 'node_modules'), path.join(project, 'node_modules'), 'junction');
  writeFileSync(
    path.join(project, 'app.json'),
    JSON.stringify({
      expo: {
        name: 'CEMYDI TLS Check',
        slug: 'cemydi-tls-check',
        android: { package: 'com.cemydi.tlscheck' },
        plugins: [
          path.join(root, 'plugins/with-android-java.cjs'),
          path.join(root, 'plugins/with-android-security.cjs'),
        ],
      },
    }),
  );
  const options = {
    cwd: project,
    encoding: 'utf8',
    timeout: 120000,
    env: {
      ...process.env,
      CI: '1',
      EXPO_NO_DOTENV: '1',
      EXPO_NO_GIT_STATUS: '1',
      EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_API_URL: 'https://api.example.com',
    },
  };
  const args = [
    require.resolve('expo/bin/cli'),
    'prebuild',
    '--platform',
    'android',
    '--no-install',
    '--template',
    path.join(path.dirname(require.resolve('expo/package.json')), 'template.tgz'),
  ];
  writeFileSync(path.join(project, 'prebuild.log'), execFileSync(process.execPath, args, options));
  const applicationFile = path.join(
    project,
    'android/app/src/main/java/com/cemydi/tlscheck/MainApplication.kt',
  );
  const gradleFile = path.join(project, 'android/app/build.gradle');
  // Reproduce an already-generated project containing the former plugin blocks.
  writeFileSync(
    applicationFile,
    readFileSync(applicationFile, 'utf8').replace(
      /    \/\/ CEMYDI TLS START[\s\S]*?    \/\/ CEMYDI TLS END/,
      '    // CEMYDI TLS START\n    check(false) { "Release requires current and backup API certificate pins" }\n    okhttp3.CertificatePinner.Builder()\n    // CEMYDI TLS END',
    ),
  );
  writeFileSync(
    gradleFile,
    readFileSync(gradleFile, 'utf8').replace(
      '// CEMYDI RELEASE START',
      '// CEMYDI RELEASE START\n// Release requires current and backup API certificate pins',
    ),
  );
  writeFileSync(path.join(project, 'migration.log'), execFileSync(process.execPath, args, options));
  const application = readFileSync(applicationFile, 'utf8');
  const gradle = readFileSync(gradleFile, 'utf8');
  const manifest = readFileSync(
    path.join(project, 'android/app/src/main/AndroidManifest.xml'),
    'utf8',
  );
  const gradleProperties = readFileSync(path.join(project, 'android/gradle.properties'), 'utf8');
  assert.match(gradleProperties, /-XX:MaxMetaspaceSize=1024m/);
  assert.doesNotMatch(application + gradle, /CertificatePinner|certificate pins|certificatePinner/);
  assert.match(application, /check\(BuildConfig.DEBUG \|\| true\)/);
  assert.match(application, /followRedirects\(false\)/);
  assert.match(gradle, /Release requires a dedicated signing key/);
  assert.match(gradle, /enableMinifyInReleaseBuilds/);
  assert.match(manifest, /android:networkSecurityConfig="@xml\/cemydi_network_security_config"/);
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.doesNotMatch(manifest, /android.permission.SYSTEM_ALERT_WINDOW/);
  for (const variant of ['main', 'debug', 'debugOptimized']) {
    const xml = readFileSync(
      path.join(project, 'android/app/src', variant, 'res/xml/cemydi_network_security_config.xml'),
      'utf8',
    );
    assert.ok(xml.includes(`cleartextTrafficPermitted="${variant !== 'main'}"`));
    assert.match(xml, /<certificates src="system"/);
    assert.doesNotMatch(xml, /src="user"|pin-set|@raw/);
  }
  console.log('CNG evidence:', project);
});
