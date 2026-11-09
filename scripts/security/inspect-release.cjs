const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');

function renamedClasses(mapping) {
  return [...mapping.matchAll(/^([^#\s].+) -> ([^\s]+):$/gm)]
    .map(([, original, name]) => ({ original, name }))
    .filter(({ original, name }) => original !== name && !name.startsWith('R8$$REMOVED$$CLASS$$'));
}
function manifestFlagIsFalse(manifest, flag) {
  return new RegExp(
    `\\b${flag}(?:\\([^)]*\\))?=\\s*(?:false|(?:\\(type\\s+0x12\\)\\s*)?0x0)\\s*$`,
    'm',
  ).test(manifest);
}

function assess(badging, certificate, mapping) {
  const failures = [];
  if (!badging.includes("package: name='com.cemydi.app'")) failures.push('Paquete incorrecto.');
  if (/application-debuggable/.test(badging)) failures.push('APK depurable.');
  if (/CN=Android Debug/i.test(certificate)) failures.push('Firma de depuración.');
  if (!/certificate SHA-256 digest:/i.test(certificate)) failures.push('Firma no verificada.');
  if (!renamedClasses(mapping).length)
    failures.push('No hay evidencia de renombrado R8 en mapping.txt.');
  for (const permission of [
    'CAMERA',
    'ACCESS_FINE_LOCATION',
    'ACCESS_COARSE_LOCATION',
    'READ_EXTERNAL_STORAGE',
    'WRITE_EXTERNAL_STORAGE',
    'SYSTEM_ALERT_WINDOW',
  ])
    if (badging.includes(`android.permission.${permission}'`))
      failures.push(`Permiso no necesario: ${permission}.`);
  return failures;
}

function main() {
  const [apkArgument, mappingArgument] = process.argv.slice(2);
  if (!apkArgument || !mappingArgument)
    throw new Error(
      'Uso: npm run release:inspect -- ruta.apk ruta/mapping.txt. Requiere ANDROID_HOME, JAVA_HOME y CEMYDI_JADX_HOME.',
    );
  const apk = path.resolve(apkArgument);
  const mapping = path.resolve(mappingArgument);
  const sdk = process.env.ANDROID_HOME;
  const jadx = process.env.CEMYDI_JADX_HOME;
  if (!sdk || !jadx || !existsSync(path.join(jadx, 'lib')))
    throw new Error('Falta ANDROID_HOME o CEMYDI_JADX_HOME con la distribución oficial de JADX.');
  const buildTools = path.join(sdk, 'build-tools');
  const version = readdirSync(buildTools)
    .filter((name) => /^\d+\.\d+\.\d+$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .at(-1);
  if (!version) throw new Error('No hay Android build-tools estables.');
  const directory = path.join(buildTools, version);
  const java = process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
    : 'java';
  const run = (command, args) =>
    execFileSync(command, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const output = path.resolve(
    'test-results/release',
    new Date().toISOString().replace(/[:.]/g, '-'),
  );
  mkdirSync(output, { recursive: true });
  const badging = run(path.join(directory, process.platform === 'win32' ? 'aapt2.exe' : 'aapt2'), [
    'dump',
    'badging',
    apk,
  ]);
  const manifest = run(path.join(directory, process.platform === 'win32' ? 'aapt2.exe' : 'aapt2'), [
    'dump',
    'xmltree',
    apk,
    '--file',
    'AndroidManifest.xml',
  ]);
  const certificate = run(java, [
    '-jar',
    path.join(directory, 'lib', 'apksigner.jar'),
    'verify',
    '--verbose',
    '--print-certs',
    apk,
  ]);
  const mappingText = readFileSync(mapping, 'utf8');
  const failures = assess(badging, certificate, mappingText);
  for (const flag of ['allowBackup', 'usesCleartextTraffic'])
    if (!manifestFlagIsFalse(manifest, flag))
      failures.push(`${flag} no está desactivado en el manifiesto final.`);
  writeFileSync(path.join(output, 'manifest.txt'), manifest);
  writeFileSync(path.join(output, 'badging.txt'), badging);
  writeFileSync(path.join(output, 'signature.txt'), certificate);
  writeFileSync(path.join(output, 'mapping.txt'), readFileSync(mapping));
  // JADX output is evidence of inspectability, never proof that reverse engineering is impossible.
  const mappedClasses = renamedClasses(mappingText);
  const sampleClass =
    mappedClasses.find(({ original }) => original.startsWith('com.cemydi.app.')) ??
    mappedClasses[0];
  const renamedClass = sampleClass?.name;
  const selectedClasses = [
    'com.cemydi.app.MainApplication',
    ...(renamedClass ? [renamedClass] : []),
  ];
  try {
    const version = run(java, [
      '-cp',
      path.join(jadx, 'lib', '*'),
      'jadx.cli.JadxCLI',
      '--version',
    ]);
    writeFileSync(path.join(output, 'jadx-version.txt'), version);
    const logs = [];
    for (const className of selectedClasses) {
      logs.push(
        run(java, [
          '-Xmx2g',
          '-cp',
          path.join(jadx, 'lib', '*'),
          'jadx.cli.JadxCLI',
          '-j',
          '2',
          '--single-class',
          className,
          '--single-class-output',
          path.join(output, 'jadx', `${className}.java`),
          apk,
        ]),
      );
    }
    writeFileSync(path.join(output, 'jadx.log'), logs.join('\n'));
  } catch (error) {
    writeFileSync(
      path.join(output, 'jadx.log'),
      `${error.stdout || ''}\n${error.stderr || ''}\nExit status: ${error.status ?? 'unknown'}`,
    );
    failures.push('JADX no terminó correctamente; revisar instalación y APK.');
  }
  const report = {
    apk: path.basename(apk),
    sha256: createHash('sha256').update(readFileSync(apk)).digest('hex'),
    mappingSha256: createHash('sha256').update(mappingText).digest('hex'),
    checkedAt: new Date().toISOString(),
    jadxScope: {
      kind: 'sample',
      selectedClasses,
      renamedOriginalClass: sampleClass?.original,
      wholeBinaryAudit: false,
    },
    obfuscatedClassCount: renamedClasses(mappingText).length,
    failures,
    staticChecksPassed: failures.length === 0,
    nativeBlackBox: 'pending',
    mitm: 'pending',
    scope: 'Android; ARCO y publicación excluidos',
  };
  writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  writeFileSync(
    path.join(output, 'report.md'),
    `# Inspección estática Android Release\n\nFecha UTC: ${report.checkedAt}\n\nAPK: ${report.apk}\n\nSHA-256 APK: \`${report.sha256}\`\n\nSHA-256 mapping: \`${report.mappingSha256}\`\n\nClases con nombre modificado por R8: ${report.obfuscatedClassCount}.\n\nResultado: ${report.staticChecksPassed ? 'comprobaciones estáticas aprobadas' : 'hay incidencias; revisar report.json y logs'}.\n\nJADX se ejecutó sobre una muestra: ${selectedClasses.join(', ')}. Se conservan las fuentes extraídas y los logs; no constituye una auditoría de todo el binario.\n\nIncidencias: ${failures.length ? failures.join(' ') : 'ninguna en las comprobaciones ejecutadas'}.\n\nPendientes: pruebas funcionales de caja negra en Android, proxy MitM y rotación de clave. Derechos ARCO y publicación en Google Play están excluidos. R8 dificulta el análisis; no impide toda descompilación.\n`,
  );
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
}
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { assess, manifestFlagIsFalse, renamedClasses };
