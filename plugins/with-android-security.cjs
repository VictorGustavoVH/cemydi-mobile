const {
  withAppBuildGradle,
  withMainApplication,
  withAndroidManifest,
  withGradleProperties,
  withDangerousMod,
} = require('expo/config-plugins');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');

function securitySettings(environment = process.env) {
  const production = environment.EXPO_PUBLIC_APP_ENV === 'production';
  const configuredUrl = environment.EXPO_PUBLIC_API_URL?.trim();
  if (!configuredUrl) {
    if (production) throw new Error('Release requiere una API HTTPS configurada.');
    return { httpsApi: false };
  }
  const url = new URL(configuredUrl);
  if (url.username || url.password || !['https:', 'http:'].includes(url.protocol))
    throw new Error('La API debe usar HTTP(S) sin credenciales.');
  if (production && url.protocol !== 'https:') throw new Error('Release requiere una API HTTPS.');
  return { httpsApi: url.protocol === 'https:' };
}

function networkSecurityConfig(debug = false) {
  return `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="${debug}">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>
</network-security-config>
`;
}

function configureApplication(source, settings) {
  const start = '    // CEMYDI TLS START';
  const end = '    // CEMYDI TLS END';
  source = source.replace(/    \/\/ CEMYDI TLS START[\s\S]*?    \/\/ CEMYDI TLS END\r?\n?/g, '');
  const block = `${start}
    check(BuildConfig.DEBUG || ${Boolean(settings?.httpsApi)}) { "Release requires an HTTPS API" }
    com.facebook.react.modules.network.OkHttpClientProvider.setOkHttpClientFactory {
      com.facebook.react.modules.network.OkHttpClientProvider.createClientBuilder()
        .followRedirects(false)
        .followSslRedirects(false)
        .build()
    }
${end}`;
  if (!source.includes('    super.onCreate()'))
    throw new Error('No se encontró onCreate en MainApplication.');
  return source.replace('    super.onCreate()', `    super.onCreate()\n${block}`);
}

function findBlock(source, keyword) {
  const header = new RegExp(`\\b${keyword}\\s*\\{`).exec(source);
  if (!header) return null;
  const start = source.indexOf('{', header.index);
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}' && (depth -= 1) === 0)
      return { start, end: index, body: source.slice(start + 1, index) };
  }
  return null;
}

function configureGradle(source, settings) {
  source = source.replaceAll('proguard-android.txt', 'proguard-android-optimize.txt');
  source = source.replace(
    /\r?\n\/\/ CEMYDI RELEASE START[\s\S]*?\/\/ CEMYDI RELEASE END\r?\n\r?\n/g,
    '',
  );
  // CNG's template signs release with the debug keystore. Replace only that release assignment.
  const release = findBlock(source, 'release');
  if (!release) throw new Error('No se encontró el bloque release en app/build.gradle.');
  const debugSigning = /signingConfig\s+signingConfigs\.debug/;
  if (debugSigning.test(release.body)) {
    const body = release.body.replace(
      debugSigning,
      'if (System.getenv("CEMYDI_RELEASE_STORE_FILE")) { signingConfig signingConfigs.cemydiRelease }',
    );
    source = source.slice(0, release.start + 1) + body + source.slice(release.end);
  } else if (!/signingConfigs\.cemydiRelease/.test(release.body)) {
    // Nothing to replace and no dedicated signing either: fail instead of shipping a debug key.
    throw new Error('No se encontró la firma release esperada.');
  }
  const signing = `
// CEMYDI RELEASE START
android.signingConfigs.create("cemydiRelease") {
    if (System.getenv("CEMYDI_RELEASE_STORE_FILE")) {
        storeFile file(System.getenv("CEMYDI_RELEASE_STORE_FILE"))
        storePassword System.getenv("CEMYDI_RELEASE_STORE_PASSWORD")
        keyAlias System.getenv("CEMYDI_RELEASE_KEY_ALIAS")
        keyPassword System.getenv("CEMYDI_RELEASE_KEY_PASSWORD")
    }
}
gradle.taskGraph.whenReady { graph ->
    if (graph.allTasks.any { it.project == project && it.name.toLowerCase().contains("release") }) {
        if (!${Boolean(settings?.httpsApi)}) throw new GradleException("Release requires an HTTPS API; run Expo prebuild with an HTTPS API")
        if (System.getenv("EAS_BUILD") != "true" && !["CEMYDI_RELEASE_STORE_FILE", "CEMYDI_RELEASE_STORE_PASSWORD", "CEMYDI_RELEASE_KEY_ALIAS", "CEMYDI_RELEASE_KEY_PASSWORD"].every { System.getenv(it) }) {
            throw new GradleException("Release requires a dedicated signing key")
        }
    }
}
// CEMYDI RELEASE END
`;
  // The signing config must exist before the release block references it.
  if (!source.includes('android {')) throw new Error('No se encontró el bloque Android.');
  return source.replace('android {', `${signing}\nandroid {`);
}

module.exports = (config) => {
  const settings = securitySettings();
  config = withMainApplication(config, (mod) => {
    if (mod.modResults.language !== 'kt') throw new Error('MainApplication debe usar Kotlin.');
    mod.modResults.contents = configureApplication(mod.modResults.contents, settings);
    return mod;
  });
  config = withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = configureGradle(mod.modResults.contents, settings);
    return mod;
  });
  config = withGradleProperties(config, (mod) => {
    for (const key of [
      'android.enableMinifyInReleaseBuilds',
      'android.enableShrinkResourcesInReleaseBuilds',
    ]) {
      mod.modResults = mod.modResults.filter((entry) => entry.key !== key);
      mod.modResults.push({ type: 'property', key, value: 'true' });
    }
    return mod;
  });
  config = withDangerousMod(config, [
    'android',
    async (mod) => {
      // Resource overlays preserve Metro HTTP in debug without permitting HTTP in Release.
      for (const variant of ['main', 'debug', 'debugOptimized']) {
        const directory = path.join(
          mod.modRequest.platformProjectRoot,
          'app',
          'src',
          variant,
          'res',
          'xml',
        );
        await mkdir(directory, { recursive: true });
        await writeFile(
          path.join(directory, 'cemydi_network_security_config.xml'),
          networkSecurityConfig(variant !== 'main'),
        );
      }
      return mod;
    },
  ]);
  return withAndroidManifest(config, (mod) => {
    mod.modResults.manifest['uses-permission'] = (
      mod.modResults.manifest['uses-permission'] ?? []
    ).filter((entry) => entry.$['android:name'] !== 'android.permission.SYSTEM_ALERT_WINDOW');
    const app = mod.modResults.manifest.application[0].$;
    app['android:allowBackup'] = 'false';
    app['android:usesCleartextTraffic'] = 'false';
    app['android:networkSecurityConfig'] = '@xml/cemydi_network_security_config';
    return mod;
  });
};
module.exports.securitySettings = securitySettings;
module.exports.configureApplication = configureApplication;
module.exports.configureGradle = configureGradle;

module.exports.networkSecurityConfig = networkSecurityConfig;
