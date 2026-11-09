const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { assess, manifestFlagIsFalse, renamedClasses } = require('./inspect-release.cjs');
const {
  securitySettings,
  configureApplication,
  configureGradle,
  networkSecurityConfig,
} = require('../../plugins/with-android-security.cjs');
test('capture prevention does not add broad access to photos or storage', () => {
  const blocked = require('../../app.json').expo.android.blockedPermissions;
  for (const permission of ['READ_MEDIA_IMAGES', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE'])
    assert.ok(blocked.includes(`android.permission.${permission}`));
});
test('aapt2 false and hex formats are supported without accepting true; removed R8 classes are excluded', () => {
  assert.ok(manifestFlagIsFalse('A: android:allowBackup(0x01010280)=false\n', 'allowBackup'));
  assert.ok(
    manifestFlagIsFalse('A: android:allowBackup(0x01010280)=(type 0x12)0x0\n', 'allowBackup'),
  );
  assert.ok(!manifestFlagIsFalse('A: android:allowBackup(0x01010280)=true\n', 'allowBackup'));
  assert.ok(
    !manifestFlagIsFalse(
      'A: android:allowBackup(0x01010280)=(type 0x12)0xffffffff\n',
      'allowBackup',
    ),
  );
  assert.deepEqual(renamedClasses('a.A -> R8$$REMOVED$$CLASS$$0:\nb.B -> a.b:'), [
    { original: 'b.B', name: 'a.b' },
  ]);
});
test('artifact inspection rejects debug signatures, broad permissions and absent R8 evidence', () => {
  const badging = "package: name='com.cemydi.app'";
  const certificate =
    'Signer #1 certificate DN: CN=CEMYDI Mobile Release\nSigner #1 certificate SHA-256 digest: abc';
  const mapping = 'com.example.SomeClass -> a.b:';
  assert.deepEqual(assess(badging, certificate, mapping), []);
  assert.ok(assess(badging + '\napplication-debuggable', certificate, mapping).length);
  assert.ok(
    assess(badging, certificate.replace('CEMYDI Mobile Release', 'Android Debug'), mapping).length,
  );
  assert.ok(assess(badging, certificate, '').length);
  assert.ok(assess(badging, certificate, 'com.example.SomeClass -> com.example.SomeClass:').length);
  assert.ok(
    assess(badging + "\nuses-permission: name='android.permission.CAMERA'", certificate, mapping)
      .length,
  );
});
test('production accepts HTTPS without pins and rejects HTTP, absent URL and credentials', () => {
  assert.deepEqual(securitySettings({}), { httpsApi: false });
  assert.throws(() => securitySettings({ EXPO_PUBLIC_APP_ENV: 'production' }), /HTTPS/);
  for (const url of [
    'http://api.example.com',
    'https://user:pass@api.example.com',
    'file:///tmp/api',
    'invalid',
  ]) {
    assert.throws(() =>
      securitySettings({ EXPO_PUBLIC_APP_ENV: 'production', EXPO_PUBLIC_API_URL: url }),
    );
  }
  const { apiOrigin } = require('../../config/android-api.json');
  assert.deepEqual(
    securitySettings({ EXPO_PUBLIC_APP_ENV: 'production', EXPO_PUBLIC_API_URL: apiOrigin }),
    { httpsApi: true },
  );
});

test('Release trusts system CAs only; HTTP is available only in debug resources for Metro', () => {
  for (const debug of [false, true]) {
    const xml = networkSecurityConfig(debug);
    assert.match(xml, /<certificates src="system"/);
    assert.ok(xml.includes(`cleartextTrafficPermitted="${debug}"`));
    assert.doesNotMatch(xml, /src="user"|@raw|pin-set/);
  }
});

test('a project generated for an HTTP dev API still guards Release at build and startup', () => {
  const settings = securitySettings({ EXPO_PUBLIC_API_URL: 'http://localhost:4000' });
  const application = configureApplication(
    'override fun onCreate() {\n    super.onCreate()\n}',
    settings,
  );
  assert.match(application, /check\(BuildConfig.DEBUG \|\| false\)/);
  const gradle = configureGradle(
    'android { buildTypes { release { signingConfig signingConfigs.debug } } }',
    settings,
  );
  assert.match(gradle, /if \(!false\) throw new GradleException/);
});

test('system TLS preserves RN defaults and disables redirects before React loads; removes legacy pinning', () => {
  const settings = { httpsApi: true };
  const source =
    'override fun onCreate() {\n    super.onCreate()\n    // CEMYDI TLS START\n    .certificatePinner(oldPins)\n    // CEMYDI TLS END\n    loadReactNative(this)\n}';
  const result = configureApplication(source, settings);
  assert.equal(configureApplication(result, settings), result);
  assert.ok(result.indexOf('setOkHttpClientFactory') < result.indexOf('loadReactNative'));
  for (const expected of [
    '.followRedirects(false)',
    '.followSslRedirects(false)',
    'createClientBuilder()',
    'check(BuildConfig.DEBUG || true)',
  ])
    assert.ok(result.includes(expected));
  assert.doesNotMatch(
    result,
    /certificatePinner|oldPins|sslSocketFactory|hostnameVerifier|trustAll/,
  );
});

test('release signing replaces debug signing and guards local and EAS builds', () => {
  const source =
    'apply plugin: "com.android.application"\nandroid { buildTypes { debug { signingConfig signingConfigs.debug } release { signingConfig signingConfigs.debug } } }';
  const result = configureGradle(source, { httpsApi: true });
  assert.equal(configureGradle(result, { httpsApi: true }), result);
  assert.match(result, /release \{ if \(System.getenv/);
  assert.ok(result.indexOf('apply plugin') < result.indexOf('android.signingConfigs.create'));
  assert.ok(result.indexOf('android.signingConfigs.create') < result.indexOf('android {'));
  assert.ok(configureGradle(source, null).includes('if (!false) throw new GradleException'));
});
test('release signing fails closed when debug and dedicated signing are both absent', () => {
  assert.throws(
    () => configureGradle('android { buildTypes { release { minifyEnabled true } } }', null),
    /firma release/,
  );
  assert.throws(
    () =>
      configureGradle(
        'android { buildTypes { release { signingConfig signingConfigs.release } } }',
        null,
      ),
    /firma release/,
  );
  assert.throws(
    () => configureGradle('android { buildTypes { debug {} } }', null),
    /bloque release/,
  );
});
test('network security hook exists in installed React Native and production flags are enabled', () => {
  const provider = readFileSync(
    path.join(
      require.resolve('react-native/package.json'),
      '..',
      'ReactAndroid/src/main/java/com/facebook/react/modules/network/OkHttpClientProvider.kt',
    ),
    'utf8',
  );
  assert.match(provider, /setOkHttpClientFactory/);
  const expoFetch = readFileSync(
    path.join(
      path.dirname(require.resolve('expo/package.json')),
      'android/src/main/java/expo/modules/fetch/ExpoFetchModule.kt',
    ),
    'utf8',
  );
  assert.match(expoFetch, /OkHttpClientProvider.createClient\(reactContext\)/);
  const plugin = readFileSync(
    path.join(
      path.dirname(require.resolve('../../package.json')),
      'plugins/with-android-security.cjs',
    ),
    'utf8',
  );
  assert.match(plugin, /android.enableMinifyInReleaseBuilds/);
  assert.match(plugin, /android.enableShrinkResourcesInReleaseBuilds/);
});
