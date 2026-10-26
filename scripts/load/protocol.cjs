// This protocol has no destination, credentials, environment or CLI overrides.
const PROTOCOL = 'cemydi-local-http/1';
const LIMITS = Object.freeze({ requests: 180, concurrency: 4, durationMs: 180_000 });
const TIMEOUT_MS = 2000;
const PATHS = Object.freeze([
  '/products?page=1&pageSize=2&sort=reciente',
  '/products?search=Equipo&soloDisponibles=true',
  '/products/1',
  '/products/2',
  '/products/1/recommendations?limit=5',
  '/reviews/product/1',
  '/promotions',
]);
const PHASES = Object.freeze(
  [
    ['warmup', 1, 10],
    ['baseline', 1, 30],
    ['moderate', 2, 40],
    ['bursts', 4, 80],
    ['faults', 2, 20],
  ].map(([name, concurrency, total]) =>
    Object.freeze({ name, concurrency, rate: concurrency, total }),
  ),
);

function assertRequest(method, path) {
  if (method !== 'GET' || !PATHS.includes(path)) throw new Error('UNPLANNED_REQUEST');
}

function expectedFault(phase, index) {
  if (phase !== 'faults') return 'normal';
  if (index < 2) return 'http503';
  if (index < 4) return 'timeout';
  return 'normal';
}

module.exports = { PROTOCOL, LIMITS, TIMEOUT_MS, PATHS, PHASES, assertRequest, expectedFault };
