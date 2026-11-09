const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const { checkDependencyAudit } = require('./audit.cjs');

test('shell-quote rejects line terminators after comments without executing a shell', () => {
  const { quote } = require('shell-quote');
  for (const terminator of ['\n', '\r', '\u2028', '\u2029'])
    assert.throws(() => quote(['echo', { comment: 'fixture' }, `a${terminator}id;#`]), TypeError);
  assert.equal(quote(['echo', 'two words']), "echo 'two words'");
});

test('query-string keeps its CommonJS API and Unicode, repeated, empty and malformed parameters', () => {
  const query = require('query-string');
  const parsed = query.parse('search=ortopedia+ni%C3%B1os&tag=a&tag=b&empty=&flag');
  assert.deepEqual(
    { ...parsed },
    { search: 'ortopedia niños', tag: ['a', 'b'], empty: '', flag: null },
  );
  assert.deepEqual({ ...query.parse(query.stringify(parsed)) }, { ...parsed });
  assert.equal(query.parse('value=%C0').value, '%C0');
  const requireFromQuery = createRequire(require.resolve('query-string'));
  assert.equal(typeof requireFromQuery('decode-uri-component'), 'function');
});

test('malformed decoding completes in a bounded subprocess through the actual consumer', () => {
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      "const q=require('query-string'); for(const n of [500,1500,32000]) { const input='%C0'.repeat(n); if(q.parse('value='+input).value!==input) process.exit(2); }",
    ],
    {
      cwd: require('node:path').dirname(require.resolve('../../package.json')),
      timeout: 5_000,
      encoding: 'utf8',
      windowsHide: true,
    },
  );
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
});

test('Expo CLI JSON schemas and MCP extensions retain validation with application Zod', () => {
  const requireFromExpo = createRequire(require.resolve('expo/package.json'));
  const requireFromCli = createRequire(requireFromExpo.resolve('@expo/cli/package.json'));
  const { PluginSchema, DevToolsPluginOutputSchema } = requireFromCli(
    './build/src/start/server/devtools/DevToolsPlugin.schema.js',
  );
  const { validate } = requireFromCli('@expo/schema-utils');
  assert.doesNotThrow(() =>
    validate(PluginSchema, { packageName: 'fixture', packageRoot: '/fixture' }),
  );
  assert.throws(() => validate(PluginSchema, { packageName: '', packageRoot: 3 }));
  assert.doesNotThrow(() =>
    validate(DevToolsPluginOutputSchema, [{ type: 'text', text: 'fixture', level: 'info' }]),
  );
  assert.throws(() => validate(DevToolsPluginOutputSchema, [{ type: 'image', url: 'invalid' }]));
  const { createMCPDevToolsExtensionSchema } = requireFromCli(
    './build/src/start/server/mcp/createMCPDevToolsExtensionSchema.js',
  );
  const { z } = require('zod');
  const schema = createMCPDevToolsExtensionSchema(
    {
      cliExtensions: {
        commands: [
          { name: 'fixture', title: 'Fixture', parameters: [{ name: 'count', type: 'number' }] },
        ],
      },
    },
    z,
  );
  assert.equal(schema.safeParse({ command: 'fixture', count: 2 }).success, true);
  assert.equal(schema.safeParse({ command: 'other', count: 2 }).success, false);
  assert.equal(schema.safeParse({ command: 'fixture', count: 'bad' }).success, false);
  assert.equal(schema.safeParse({ command: 'fixture', extra: true }).success, false);
  const jsonSchema = z.toJSONSchema(schema);
  assert.equal(jsonSchema.additionalProperties, false);
  assert.deepEqual(jsonSchema.properties.command.enum, ['fixture']);
});

test('modern glob and Expo fingerprint preserve file matching and ignored directories', async () => {
  const requireFromConfig = createRequire(require.resolve('@expo/config/package.json'));
  const { glob } = requireFromConfig('glob');
  const files = await glob('src/config/*.ts', {
    cwd: require('node:path').dirname(require.resolve('../../package.json')),
  });
  assert.ok(files.map((file) => file.replaceAll('\\', '/')).includes('src/config/env.ts'));
  const {
    isIgnoredPath,
    buildDirMatchObjects,
    buildPathMatchObjects,
  } = require('@expo/fingerprint/build/utils/Path.js');
  assert.equal(isIgnoredPath('node_modules/example/index.js', ['**/node_modules/**']), true);
  assert.equal(isIgnoredPath('src/config/env.ts', ['**/node_modules/**']), false);
  assert.ok(
    buildDirMatchObjects(buildPathMatchObjects(['assets/**'])).some((item) => item.match('assets')),
  );
  await assert.rejects(glob('**/*', { signal: AbortSignal.abort() }));
});

const audit = (severity) => ({
  auditReportVersion: 2,
  vulnerabilities: severity ? { fixture: { name: 'fixture', severity, via: [] } } : {},
  metadata: {
    vulnerabilities: {
      info: 0,
      low: 0,
      moderate: 0,
      high: 0,
      critical: 0,
      ...(severity ? { [severity]: 1 } : {}),
      total: severity ? 1 : 0,
    },
  },
});

test('dependency policy blocks high/critical and retains every lower finding without exceptions', () => {
  assert.equal(checkDependencyAudit(audit(), 0).passed, true);
  for (const severity of ['high', 'critical'])
    assert.equal(checkDependencyAudit(audit(severity), 1).passed, false);
  for (const severity of ['low', 'moderate']) {
    const result = checkDependencyAudit(audit(severity), 1);
    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 1);
  }
});

test('dependency policy fails closed on missing reports, scanner errors and inconsistent counts', () => {
  for (const report of [
    null,
    {},
    { ...audit(), error: { message: 'offline' } },
    { ...audit(), auditReportVersion: 1 },
    { ...audit(), metadata: {} },
  ])
    assert.throws(() => checkDependencyAudit(report, 0));
  for (const status of [null, 2, 124]) assert.throws(() => checkDependencyAudit(audit(), status));
  assert.throws(() => checkDependencyAudit(audit(), 1));
  assert.throws(() => checkDependencyAudit({ ...audit(), vulnerabilities: [] }, 0));
  assert.throws(() => checkDependencyAudit(audit('high'), 0));
  const inconsistent = audit('high');
  inconsistent.metadata.vulnerabilities.high = 0;
  assert.throws(() => checkDependencyAudit(inconsistent, 1));
  assert.throws(() => checkDependencyAudit(audit('unknown'), 1));
});
