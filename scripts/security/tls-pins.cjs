const tls = require('node:tls');
const { X509Certificate, createHash } = require('node:crypto');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const url = new URL(process.argv[2] || '');
if (url.protocol !== 'https:' || url.username || url.password)
  throw new Error('Usa un origen HTTPS sin credenciales.');
const socket = tls.connect(
  {
    host: url.hostname,
    port: Number(url.port) || 443,
    servername: url.hostname,
    rejectUnauthorized: true,
  },
  () => {
    const chain = [];
    const seen = new Set();
    let peer = socket.getPeerCertificate(true);
    while (peer.raw && !seen.has(peer.fingerprint256)) {
      seen.add(peer.fingerprint256);
      const cert = new X509Certificate(peer.raw);
      chain.push({
        subject: cert.subject,
        issuer: cert.issuer,
        validTo: cert.validTo,
        pin:
          'sha256/' +
          createHash('sha256')
            .update(cert.publicKey.export({ type: 'spki', format: 'der' }))
            .digest('base64'),
      });
      peer = peer.issuerCertificate || {};
    }
    const report = {
      host: url.hostname,
      verifiedAt: new Date().toISOString(),
      authorized: socket.authorized,
      chain,
      note: 'Diagnóstico de la cadena pública con validación TLS; estas huellas no se fijan en la app.',
    };
    const directory = path.resolve('test-results/security/tls');
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, 'observed-chain.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    socket.end();
  },
);
socket.setTimeout(15000, () => socket.destroy(new Error('Timeout TLS.')));
socket.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
