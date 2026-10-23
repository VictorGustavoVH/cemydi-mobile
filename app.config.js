const base = require('./app.json').expo;

module.exports = () => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  const iosClientSuffix = '.apps.googleusercontent.com';
  const hasValidIosClient = Boolean(iosClientId && iosClientId.endsWith(iosClientSuffix));
  const googleReady = Boolean(
    base.android?.package &&
    base.ios?.bundleIdentifier &&
    webClientId &&
    (!iosClientId || hasValidIosClient),
  );

  return {
    ...base,
    extra: {
      ...base.extra,
      googleNativeConfigured: googleReady,
      ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim()
        ? { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID.trim() } }
        : {}),
    },
    android: {
      ...base.android,
      ...(process.env.GOOGLE_SERVICES_JSON?.trim()
        ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON.trim() }
        : {}),
    },
    plugins: [
      ...base.plugins,
      './plugins/with-android-java.cjs',
      './plugins/with-android-cmake.cjs',
      ...(hasValidIosClient
        ? [
            [
              'react-native-nitro-google-signin',
              {
                iosUrlScheme: `com.googleusercontent.apps.${iosClientId.slice(0, -iosClientSuffix.length)}`,
              },
            ],
          ]
        : []),
    ],
  };
};
