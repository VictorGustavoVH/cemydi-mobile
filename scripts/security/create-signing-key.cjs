const { execFileSync } = require('node:child_process');
const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { randomBytes } = require('node:crypto');
const path = require('node:path');

// Creates a dedicated local identity; never overwrites an existing key or prints passwords.
const directory = path.resolve('.credentials');
const keystore = path.join(directory, 'cemydi-release.jks');
const configuration = path.join(directory, 'signing.json');
if (existsSync(keystore) || existsSync(configuration))
  throw new Error('Ya existe material de firma. No se reemplazará.');
if (!process.env.JAVA_HOME) throw new Error('Configura JAVA_HOME con un JDK que incluya keytool.');
mkdirSync(directory, { recursive: true });
const password = randomBytes(32).toString('hex');
execFileSync(
  path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool'),
  [
    '-genkeypair',
    '-storetype',
    'PKCS12',
    '-keystore',
    keystore,
    '-alias',
    'cemydi-release',
    '-keyalg',
    'RSA',
    '-keysize',
    '3072',
    '-validity',
    '10000',
    '-dname',
    'CN=CEMYDI Mobile Release',
    '-storepass:env',
    'CEMYDI_SIGNING_PASSWORD',
    '-keypass:env',
    'CEMYDI_SIGNING_PASSWORD',
  ],
  { env: { ...process.env, CEMYDI_SIGNING_PASSWORD: password }, stdio: 'pipe' },
);
writeFileSync(
  configuration,
  JSON.stringify(
    { keystore, storePassword: password, keyAlias: 'cemydi-release', keyPassword: password },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(
  'Firma creada en .credentials/. Conserva una copia privada y protegida; nunca la subas a Git.',
);
