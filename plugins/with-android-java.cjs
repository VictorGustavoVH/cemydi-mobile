const { withDangerousMod, withGradleProperties } = require('expo/config-plugins');
const { readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');

// JAVA_TOOL_OPTIONS reaches Prefab's child JVM; Gradle's own JVM args do not.
// Put it in the generated wrappers so Expo CLI and direct Gradle builds agree.
const marker = 'CEMYDI: enable native access for Prefab child JVMs';
const option = '--enable-native-access=ALL-UNNAMED';

module.exports = (config) => {
  config = withGradleProperties(config, (mod) => {
    // The Expo template's 512 MB limit was reached while packaging this app.
    // Preserve the heap limit and any explicitly customized metaspace setting.
    const options = mod.modResults.find(
      (entry) => entry.type === 'property' && entry.key === 'org.gradle.jvmargs',
    );
    if (options) {
      options.value = options.value.replace(
        /-XX:MaxMetaspaceSize=512m\b/i,
        '-XX:MaxMetaspaceSize=1024m',
      );
    }
    return mod;
  });
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const wrappers = [
        {
          name: 'gradlew.bat',
          anchor: 'if "%OS%"=="Windows_NT" setlocal',
          addition: `@rem ${marker}\nset "JAVA_TOOL_OPTIONS=%JAVA_TOOL_OPTIONS% ${option}"`,
        },
        {
          name: 'gradlew',
          anchor: '#!/bin/sh',
          addition: `# ${marker}\nexport JAVA_TOOL_OPTIONS="\${JAVA_TOOL_OPTIONS:+$JAVA_TOOL_OPTIONS }${option}"`,
        },
      ];
      for (const wrapper of wrappers) {
        const filename = path.join(mod.modRequest.platformProjectRoot, wrapper.name);
        const contents = await readFile(filename, 'utf8');
        if (contents.includes(marker)) continue;
        if (!contents.includes(wrapper.anchor))
          throw new Error(`No se encontró el punto de configuración Java en ${wrapper.name}.`);
        const newline = contents.includes('\r\n') ? '\r\n' : '\n';
        const addition = wrapper.addition.replace(/\n/g, newline);
        await writeFile(
          filename,
          contents.replace(wrapper.anchor, `${wrapper.anchor}${newline}${addition}`),
        );
      }
      const wrapperPropertiesFile = path.join(
        mod.modRequest.platformProjectRoot,
        'gradle',
        'wrapper',
        'gradle-wrapper.properties',
      );
      try {
        let propContent = await readFile(wrapperPropertiesFile, 'utf8');
        if (/^networkTimeout=/m.test(propContent)) {
          propContent = propContent.replace(/^networkTimeout=\d+/m, 'networkTimeout=120000');
        } else {
          propContent += `${propContent.endsWith('\n') ? '' : '\n'}networkTimeout=120000\n`;
        }
        await writeFile(wrapperPropertiesFile, propContent);
      } catch {
        // Ignorar si el wrapper no existe en este entorno
      }
      return mod;
    },
  ]);
};
