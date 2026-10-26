const http = require('node:http');
const { performance } = require('node:perf_hooks');
const { createFixtureApi } = require('../maestro-api.cjs');
const { assertRequest, TIMEOUT_MS } = require('./protocol.cjs');

// fixtureFactory is an internal regression-test seam; it cannot change the bind address.
async function createLocalSession({
  fixtureFactory = createFixtureApi,
  onCritical = () => {},
} = {}) {
  const server = fixtureFactory(() => onCritical('FIXTURE_REJECTED_REQUEST'));
  const fixture = server.listeners('request')[0];
  const pending = new Map();
  const timers = new Set();
  const sockets = new Set();
  const active = new Set();
  let sequence = 0;
  let closed = false;
  server.removeAllListeners('request');
  server.on('request', (request, response) => {
    const plan = pending.get(request.headers['x-cemydi-load-id']);
    pending.delete(request.headers['x-cemydi-load-id']);
    try {
      assertRequest(request.method, request.url);
      if (!plan || request.headers.authorization || request.headers.cookie)
        throw new Error('UNPLANNED_REQUEST');
    } catch {
      onCritical('UNPLANNED_REQUEST');
      response.destroy();
      return;
    }
    if (plan.fault === 'timeout') return; // Client deadline destroys this socket.
    if (plan.fault === 'http503') {
      response.writeHead(503, { 'Content-Type': 'application/json' });
      response.end('{"message":"Synthetic load fault"}');
      return;
    }
    const serveFixture = () => {
      try {
        fixture(request, response);
      } catch {
        onCritical('SERVER_HANDLER_ERROR');
        response.destroy();
      }
    };
    if (!plan.delayMs) return serveFixture();
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!response.destroyed) serveFixture();
    }, plan.delayMs);
    timers.add(timer);
    response.on('close', () => {
      clearTimeout(timer);
      timers.delete(timer);
    });
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  server.removeAllListeners('error');
  server.on('error', () => onCritical('SERVER_ERROR'));
  server.on('close', () => {
    if (!closed) onCritical('SERVER_CLOSED');
  });
  const port = server.address().port;

  function request({
    path,
    method = 'GET',
    fault = 'normal',
    delayMs = 0,
    signal,
    timeoutMs = TIMEOUT_MS,
  }) {
    try {
      assertRequest(method, path);
    } catch (error) {
      onCritical('UNPLANNED_REQUEST');
      throw error;
    }
    const address = server.address();
    if (closed || !address || address.address !== '127.0.0.1' || address.port !== port) {
      onCritical('DESTINATION_VIOLATION');
      throw new Error('DESTINATION_VIOLATION');
    }
    if (!['normal', 'http503', 'timeout'].includes(fault)) throw new Error('INVALID_FAULT');
    if (!(timeoutMs > 0 && timeoutMs <= TIMEOUT_MS) || ![0, 200].includes(delayMs))
      throw new Error('INVALID_TIMING');
    const id = String(++sequence);
    const start = performance.now();
    return new Promise((resolve) => {
      let settled = false;
      let bytes = 0;
      let status = null;
      let timer;
      let req;
      const finish = (kind) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        pending.delete(id);
        active.delete(req);
        if (kind !== 'success' && kind !== 'http') req?.destroy();
        resolve({ kind, status, bytes, durationMs: performance.now() - start });
      };
      const abort = () => finish('cancelled');
      if (signal?.aborted) return finish('cancelled');
      pending.set(id, { fault, delayMs });
      // Numeric IPv4 + explicit direct HTTP transport: no DNS, proxy, fetch or redirects.
      req = http.request({
        host: '127.0.0.1',
        family: 4,
        port,
        path,
        method,
        agent: false,
        headers: { 'x-cemydi-load-id': id },
      });
      active.add(req);
      signal?.addEventListener('abort', abort, { once: true });
      timer = setTimeout(
        () => finish('timeout'),
        Math.max(0, timeoutMs - (performance.now() - start)),
      );
      req.on('socket', (socket) => {
        socket.on('connect', () => {
          if (socket.remoteAddress !== '127.0.0.1' || socket.remotePort !== port) {
            onCritical('DESTINATION_VIOLATION');
            finish('destination');
          }
        });
      });
      req.on('response', (response) => {
        status = response.statusCode;
        if (status >= 300 && status < 400) {
          finish('redirect');
          onCritical('REDIRECT');
          return;
        }
        response.on('data', (chunk) => (bytes += chunk.length));
        response.on('end', () => finish(status === 200 ? 'success' : 'http'));
        response.on('error', () => finish('transport'));
        response.on('aborted', () => finish('transport'));
      });
      req.on('error', () => finish('transport'));
      req.end();
    });
  }

  async function close() {
    closed = true;
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    for (const req of active) req.destroy();
    for (const socket of sockets) socket.destroy();
    pending.clear();
    await new Promise((resolve) => server.close(resolve));
  }

  return { request, close, port };
}

module.exports = { createLocalSession };
