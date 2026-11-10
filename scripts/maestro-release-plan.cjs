/* global __dirname */
// Preparation only: never invokes ADB, installs a binary or contacts a server.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { checkFlows } = require('./maestro-check.cjs');

const releaseBootstrap = `appId: \${APP_ID}
---
# Dedicated authorized Release test installation; preserves application data.
- stopApp
- launchApp:
    clearState: false
- extendedWaitUntil:
    visible: Omitir introducción y explorar catálogo
    timeout: 30000
`;

function prepareReleaseFlows(source, output) {
  const sourceRoot = path.resolve(source);
  const outputRoot = path.resolve(output);
  if (
    sourceRoot === outputRoot ||
    outputRoot.startsWith(sourceRoot + path.sep) ||
    sourceRoot.startsWith(outputRoot + path.sep)
  )
    throw new Error('El staging debe estar separado de las fuentes.');
  if (fs.existsSync(outputRoot)) throw new Error('No sobrescribir evidencia existente.');
  const flows = checkFlows(sourceRoot);
  fs.mkdirSync(path.dirname(outputRoot), { recursive: true });
  fs.cpSync(sourceRoot, outputRoot, { recursive: true });
  fs.writeFileSync(path.join(outputRoot, 'support/open-app.yaml'), releaseBootstrap);
  const digest = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const files = [];
  function visit(relative = '') {
    for (const entry of fs.readdirSync(path.join(sourceRoot, relative), { withFileTypes: true })) {
      const name = path.join(relative, entry.name);
      if (entry.isDirectory()) visit(name);
      else {
        const before = digest(path.join(sourceRoot, name));
        const after = digest(path.join(outputRoot, name));
        const bootstrap = name === path.join('support', 'open-app.yaml');
        if (!bootstrap && before !== after) throw new Error(`Cambió un flujo funcional: ${name}`);
        files.push({
          file: name.replaceAll(path.sep, '/'),
          sourceSha256: before,
          stagedSha256: after,
          bootstrap,
          unchanged: before === after,
        });
      }
    }
  }
  visit();
  checkFlows(outputRoot);
  const manifest = {
    kind: 'Release bootstrap preparation, not a native test',
    nativeExecution: false,
    flows,
    files,
    requiredBeforeExecution: [
      'Dedicated authorized device with a verified non-debuggable Release binary targeting an isolated HTTPS API.',
      'Disposable PostgreSQL and synthetic accounts/data; prevent real email, push and external storage side effects.',
      'Validate fixture-specific labels, IDs and credentials against the isolated seed; no assertion may be dropped to hide a failure.',
      'Define per-scenario session/cart/backend reset on disposable data. This generator never clears application data or resets a server.',
    ],
  };
  fs.writeFileSync(
    path.join(outputRoot, 'release-plan.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  return manifest;
}

if (require.main === module) {
  if (process.argv.length !== 2) throw new Error('Sin argumentos: solo prepara un staging nuevo.');
  const root = path.resolve(__dirname, '..');
  const output = path.join(
    root,
    'test-results',
    `release-readiness-${new Date().toISOString().replace(/[:.]/g, '-')}`,
  );
  const manifest = prepareReleaseFlows(path.join(root, '.maestro'), output);
  console.log(JSON.stringify({ output, flowCount: manifest.flows.length, nativeExecution: false }));
}
module.exports = { prepareReleaseFlows, releaseBootstrap };
