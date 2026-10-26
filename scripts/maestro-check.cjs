const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

function checkFlows(
  root = path.join(path.dirname(require.resolve('../package.json')), '.maestro'),
) {
  function documents(file) {
    return YAML.parseAllDocuments(readFileSync(file, 'utf8')).map((doc) => {
      if (doc.errors.length) throw new Error(`${file}: ${doc.errors[0].message}`);
      return doc.toJS();
    });
  }
  const [config] = documents(path.join(root, 'config.yaml'));
  if (!Array.isArray(config.flows) || !config.flows.length)
    throw new Error('No hay flujos Maestro.');
  const visited = new Set();
  function visit(relative) {
    const file = path.resolve(root, relative);
    if (!file.startsWith(`${path.resolve(root)}${path.sep}`))
      throw new Error('Flujo fuera de .maestro.');
    if (visited.has(file)) return;
    visited.add(file);
    const [header, commands] = documents(file);
    if (header?.appId !== '${APP_ID}' || !Array.isArray(commands) || !commands.length)
      throw new Error(`Cabecera o comandos inválidos: ${relative}`);
    function walk(value) {
      if (!value || typeof value !== 'object') return;
      if (typeof value.runFlow === 'string')
        visit(path.relative(root, path.resolve(path.dirname(file), value.runFlow)));
      for (const child of Object.values(value)) walk(child);
    }
    walk(commands);
  }
  for (const flow of config.flows) visit(flow);
  for (const name of readdirSync(path.join(root, 'support')))
    if (name.endsWith('.yaml')) visit(`support/${name}`);
  return config.flows;
}
module.exports = { checkFlows };
