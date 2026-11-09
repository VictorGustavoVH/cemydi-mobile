const { withProjectBuildGradle } = require('expo/config-plugins');

const marker = '// CEMYDI: short Windows staging paths for native CMake builds';
const staging = `
${marker}
if (System.getProperty('os.name').toLowerCase().contains('windows')) {
  subprojects { subproject ->
    def moduleKeys = ['app': 'a', 'react-native-nitro-google-signin': 'g', 'expo-modules-core': 'e', 'react-native-reanimated': 'r', 'react-native-worklets': 'w', 'react-native-screens': 's', 'react-native-gesture-handler': 'h']
    if (moduleKeys.containsKey(subproject.name)) {
      def pluginId = subproject.name == 'app' ? 'com.android.application' : 'com.android.library'
      subproject.plugins.withId(pluginId) {
        def workspaceKey = Integer.toHexString(rootProject.projectDir.absolutePath.hashCode())
        def moduleKey = moduleKeys[subproject.name]
        subproject.android.externalNativeBuild.cmake.buildStagingDirectory = new File(
          System.getProperty('user.home'), '.cm/cemydi/' + workspaceKey + '/' + moduleKey
        )
        subproject.android.defaultConfig.externalNativeBuild.cmake.arguments.add('-DCMAKE_OBJECT_PATH_MAX=' + (subproject.name == 'app' ? '250' : '240'))
      }
    }
  }
}
`;

module.exports = (config) =>
  withProjectBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes(marker))
      mod.modResults.contents = staging + mod.modResults.contents;
    return mod;
  });
