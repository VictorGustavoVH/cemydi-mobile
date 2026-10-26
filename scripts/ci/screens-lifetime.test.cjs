const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { mkdtemp, mkdir, readFile, writeFile, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { patchScreens } = require('../../plugins/with-android-screens-lifetime.cjs');
const manifest = require('../../plugins/react-native-screens-4.26.2/manifest.json');

const installedRoot = path.dirname(require.resolve('react-native-screens/package.json'));
const patchedRoot = path.resolve('plugins/react-native-screens-4.26.2');

async function copyFixture(t, from = installedRoot) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cemydi-screens-lifetime-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ version: manifest.version }));
  for (const file of manifest.files) {
    const destination = path.join(root, file.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, await readFile(path.join(from, file.path)));
  }
  return root;
}

async function contents(root) {
  return Promise.all(manifest.files.map((file) => readFile(path.join(root, file.path), 'utf8')));
}

test('Screens: prebuild aplica el backport completo y es idempotente', async (t) => {
  const root = await copyFixture(t);
  const count = await patchScreens(root);
  assert.ok(count === 0 || count === 4); // La dependencia puede haber pasado ya por prebuild.
  assert.deepEqual(await contents(root), await contents(patchedRoot));
  assert.equal(await patchScreens(root), 0);
});

test('Screens: una fuente desconocida impide todas las escrituras', async (t) => {
  const root = await copyFixture(t);
  const lastFile = path.join(root, manifest.files.at(-1).path);
  await writeFile(lastFile, `${await readFile(lastFile, 'utf8')}\n// cambio inesperado\n`);
  const before = await contents(root);
  await assert.rejects(patchScreens(root), /Fuente Screens no reconocida/);
  assert.deepEqual(await contents(root), before);
});

test('Screens: no aplica un backport a otra versión', async (t) => {
  const root = await copyFixture(t);
  await writeFile(path.join(root, 'package.json'), '{"version":"4.27.0"}');
  const before = await contents(root);
  await assert.rejects(patchScreens(root), /versión no admitida/);
  assert.deepEqual(await contents(root), before);
});

test('Screens: rechaza reemplazos alterados antes de modificar la dependencia', async (t) => {
  const root = await copyFixture(t);
  const replacements = await copyFixture(t, patchedRoot);
  await writeFile(path.join(replacements, manifest.files.at(-1).path), 'fuente alterada');
  const before = await contents(root);
  await assert.rejects(patchScreens(root, replacements), /Fuente del parche Screens alterada/);
  assert.deepEqual(await contents(root), before);
});

test('Screens: los hashes del backport son independientes de CRLF', async (t) => {
  const root = await copyFixture(t, patchedRoot);
  for (const file of manifest.files) {
    const target = path.join(root, file.path);
    const source = (await readFile(target, 'utf8')).replace(/\r?\n/g, '\r\n');
    await writeFile(target, source);
    assert.equal(
      createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('hex'),
      file.after,
    );
  }
  assert.equal(await patchScreens(root), 0);
});
