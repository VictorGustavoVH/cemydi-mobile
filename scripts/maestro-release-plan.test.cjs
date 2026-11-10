/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const YAML = require('yaml');
const { prepareReleaseFlows } = require('./maestro-release-plan.cjs');

test('Release staging preserves all 13 functional flows and replaces only the Dev Launcher bootstrap', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'cemydi-release-plan-'));
  const output = path.join(parent, 'flows');
  const source = path.resolve(__dirname, '../.maestro');
  const manifest = prepareReleaseFlows(source, output);
  assert.equal(manifest.flows.length, 13);
  assert.equal(manifest.nativeExecution, false);
  assert.ok(manifest.files.filter((file) => !file.bootstrap).every((file) => file.unchanged));
  assert.equal(manifest.files.filter((file) => !file.unchanged).length, 1);
  const text = fs.readFileSync(path.join(output, 'support/open-app.yaml'), 'utf8');
  const commands = YAML.parseAllDocuments(text)[1].toJS();
  assert.equal(commands[0], 'stopApp');
  assert.deepEqual(commands[1], { launchApp: { clearState: false } });
  assert.doesNotMatch(text, /DEV_CLIENT_URL|Connect|openLink|clearState: true/);
  assert.throws(() => prepareReleaseFlows(source, output), /sobrescribir/);
});

test('Release preparation rejects source overlap before any copy or mutation', () => {
  const source = path.resolve(__dirname, '../.maestro');
  for (const output of [source, path.join(source, 'staged'), path.dirname(source)]) {
    assert.throws(() => prepareReleaseFlows(source, output), /separado/);
  }
});
