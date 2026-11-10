const { execFileSync } = require('node:child_process');
const mode = process.argv[2];
const labels = process.argv.slice(3);
if (!['inspect', 'tap'].includes(mode) || !labels.length)
  throw new Error('Usa inspect/tap y etiquetas esperadas.');
const serial = process.env.CEMYDI_E2E_DEVICE;
if (!serial) throw new Error('Configura CEMYDI_E2E_DEVICE con el dispositivo autorizado.');
const adb = (...args) =>
  execFileSync('adb', ['-s', serial, ...args], { encoding: 'utf8', timeout: 30000 });
const focus =
  adb('shell', 'dumpsys', 'window')
    .split('\n')
    .find((line) => line.includes('mCurrentFocus=')) || '';
if (
  !/com\.cemydi\.app|com\.android\.documentsui|com\.google\.android\.documentsui|com\.android\.settings|com\.huawei\.systemmanager|com\.android\.permissioncontroller|com\.android\.packageinstaller/.test(
    focus,
  )
)
  throw new Error('Superficie de prueba fuera de alcance.');
// Never store the hierarchy: the picker may list unrelated personal filenames.
// Emit only the exact synthetic/system labels requested by the caller.
const xml = adb('exec-out', 'uiautomator', 'dump', '/dev/tty');
const found = [];
for (const tag of xml.matchAll(/<node\b[^>]*>/g)) {
  const attrs = Object.fromEntries(
    [...tag[0].matchAll(/([\w-]+)="([^"]*)"/g)].map((entry) => [entry[1], entry[2]]),
  );
  const label = labels.find(
    (candidate) => attrs.text === candidate || attrs['content-desc'] === candidate,
  );
  if (label)
    found.push({
      label,
      bounds: attrs.bounds,
      package: attrs.package,
      checked: attrs.checked,
      resourceId: attrs['resource-id'],
    });
}
console.log(JSON.stringify({ mode, found }));
if (mode === 'tap') {
  if (!found.length) throw new Error('Etiqueta esperada no encontrada.');
  const match = found[0].bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!match) throw new Error('Coordenadas inválidas.');
  adb(
    'shell',
    'input',
    'tap',
    String(Math.round((+match[1] + +match[3]) / 2)),
    String(Math.round((+match[2] + +match[4]) / 2)),
  );
}
