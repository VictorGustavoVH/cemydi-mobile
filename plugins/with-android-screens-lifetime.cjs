const { withDangerousMod } = require('expo/config-plugins');
const { createHash } = require('node:crypto');
const { readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');
const manifest = require('./react-native-screens-4.26.2/manifest.json');

const sourceRoot = path.dirname(require.resolve('./react-native-screens-4.26.2/manifest.json'));
const normalize = (source) => source.replace(/\r\n/g, '\n');
const hash = (source) => createHash('sha256').update(normalize(source)).digest('hex');

// Adapta la corrección original #4413 sin cambiar las dependencias de Expo ni
// los proyectos nativos. Prebuild la aplica antes de la compilación con Gradle.
async function patchScreens(moduleRoot, replacementsRoot = sourceRoot) {
  const { version } = JSON.parse(await readFile(path.join(moduleRoot, 'package.json'), 'utf8'));
  if (version !== manifest.version)
    throw new Error(`Revisar el parche de lifetime de Screens: versión no admitida ${version}.`);

  // Valida todas las entradas antes de escribir. Las fuentes desconocidas hacen
  // fallar la compilación; otro prebuild acepta el hash exacto ya corregido.
  const pending = [];
  for (const file of manifest.files) {
    const target = path.join(moduleRoot, file.path);
    const current = await readFile(target, 'utf8');
    const replacement = await readFile(path.join(replacementsRoot, file.path), 'utf8');
    if (hash(replacement) !== file.after)
      throw new Error(`Fuente del parche Screens alterada: ${file.path}.`);
    if (![file.before, file.after].includes(hash(current)))
      throw new Error(`Fuente Screens no reconocida: ${file.path}. No se aplica el parche.`);
    if (hash(current) === file.before) pending.push({ target, replacement });
  }
  for (const { target, replacement } of pending) await writeFile(target, normalize(replacement));
  return pending.length;
}

module.exports = (config) =>
  withDangerousMod(config, [
    'android',
    async (mod) => {
      const packageFile = require.resolve('react-native-screens/package.json', {
        paths: [mod.modRequest.projectRoot],
      });
      const count = await patchScreens(path.dirname(packageFile));
      console.log(`Screens ${manifest.version}: lifetime corregido (${count} fuentes aplicadas).`);
      return mod;
    },
  ]);

module.exports.patchScreens = patchScreens;
