const { withProjectBuildGradle } = require('expo/config-plugins');

const marker = '// CEMYDI: short Windows staging paths for native CMake builds';
const staging = `
${marker}
if (System.getProperty('os.name').toLowerCase().contains('windows')) {
  subprojects { subproject ->
    if (subproject.name in ['app', 'react-native-nitro-google-signin']) {
      def pluginId = subproject.name == 'app' ? 'com.android.application' : 'com.android.library'
      subproject.plugins.withId(pluginId) {
        def workspaceKey = Integer.toHexString(rootProject.projectDir.absolutePath.hashCode())
        def moduleKey = subproject.name == 'app' ? 'a' : 'g'
        subproject.android.externalNativeBuild.cmake.buildStagingDirectory = new File(
          System.getProperty('user.home'), '.cm/cemydi/' + workspaceKey + '/' + moduleKey
        )
        subproject.android.defaultConfig.externalNativeBuild.cmake.arguments.add('-DCMAKE_OBJECT_PATH_MAX=240')
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
