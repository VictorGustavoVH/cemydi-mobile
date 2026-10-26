const { performance } = require('node:perf_hooks');
const { setTimeout: sleep } = require('node:timers/promises');
const { PHASES, LIMITS, PATHS, expectedFault, assertRequest } = require('./protocol.cjs');
const { summarize } = require('./metrics.cjs');
const { createLocalSession } = require('./local-session.cjs');

// Dependency seams are for fast automated tests; the CLI always uses the fixed protocol.
async function runProfile({
  phases = PHASES,
  limits = LIMITS,
  signal,
  createSession = createLocalSession,
  now = () => performance.now(),
  wait = (ms, abortSignal) => sleep(ms, undefined, { signal: abortSignal }),
  onPhase = () => {},
} = {}) {
  const controller = new AbortController();
  const start = now();
  const records = [];
  const summaries = [];
  const progress = new Map();
  let reason = null;
  let session;
  let started = 0;
  let active = 0;
  let maxConcurrency = 0;
  let slowStreak = 0;
  let lastBatch = -Infinity;
  function stop(code) {
    reason ??= code;
    controller.abort();
  }
  const interrupt = () => stop('MANUAL_INTERRUPTION');
  signal?.addEventListener('abort', interrupt, { once: true });
  if (signal?.aborted) interrupt();
  const deadline = setTimeout(() => stop('GLOBAL_DURATION_LIMIT'), limits.durationMs);
  function guard() {
    if (now() - start >= limits.durationMs) stop('GLOBAL_DURATION_LIMIT');
    return !controller.signal.aborted;
  }
  try {
    if (
      !Number.isInteger(limits.requests) ||
      limits.requests < 1 ||
      limits.requests > LIMITS.requests ||
      !Number.isInteger(limits.concurrency) ||
      limits.concurrency < 1 ||
      limits.concurrency > LIMITS.concurrency ||
      !(limits.durationMs > 0 && limits.durationMs <= LIMITS.durationMs) ||
      phases.some(
        (phase) =>
          !Number.isInteger(phase.total) ||
          phase.total < 1 ||
          !Number.isInteger(phase.concurrency) ||
          phase.concurrency < 1 ||
          phase.concurrency > limits.concurrency ||
          phase.rate !== phase.concurrency,
      )
    ) {
      stop('INVALID_LIMITS');
    }
    if (guard()) session = await createSession({ onCritical: stop });
    for (const phase of phases) {
      const phaseStart = now();
      const phaseRecords = [];
      let phaseMax = 0;
      const state = { start: phaseStart, max: 0 };
      progress.set(phase.name, state);
      let index = 0;
      if (guard()) onPhase(phase.name);
      while (index < phase.total && guard()) {
        // Batches are at least one second apart, even across phase boundaries.
        // No pending queue: await the entire batch before considering another.
        while (now() - lastBatch < 1000 && guard()) {
          await wait(1000 - (now() - lastBatch), controller.signal);
        }
        if (!guard()) break;
        const batch = [];
        for (let slot = 0; slot < phase.concurrency && index < phase.total; slot++) {
          if (!guard()) break;
          if (started >= limits.requests) {
            stop('GLOBAL_REQUEST_LIMIT');
            break;
          }
          if (active >= limits.concurrency) {
            stop('GLOBAL_CONCURRENCY_LIMIT');
            break;
          }
          const current = index++;
          const fault = expectedFault(phase.name, current);
          const recovery = phase.name === 'faults' && current === phase.total - 1;
          const path = recovery ? '/promotions' : PATHS[current % PATHS.length];
          assertRequest('GET', path);
          const id = ++started;
          const offsetMs = now() - start;
          lastBatch = start + offsetMs;
          active++;
          phaseMax = Math.max(phaseMax, active);
          state.max = phaseMax;
          maxConcurrency = Math.max(maxConcurrency, active);
          const task = (async () => {
            let outcome;
            try {
              outcome = await session.request({
                path,
                fault,
                delayMs: phase.name === 'faults' && fault === 'normal' ? 200 : 0,
                signal: controller.signal,
              });
            } catch {
              outcome = {
                kind: 'transport',
                status: null,
                bytes: 0,
                durationMs: now() - start - offsetMs,
              };
            }
            active--;
            const expected =
              (fault === 'normal' && outcome.kind === 'success') ||
              (fault === 'http503' && outcome.kind === 'http' && outcome.status === 503) ||
              (fault === 'timeout' && outcome.kind === 'timeout');
            const record = {
              id,
              phase: phase.name,
              phaseIndex: current + 1,
              method: 'GET',
              path,
              fault,
              recovery,
              offsetMs,
              ...outcome,
              expected,
            };
            records.push(record);
            phaseRecords.push(record);
            if (!expected) stop(outcome.kind === 'redirect' ? 'REDIRECT' : 'UNEXPECTED_OUTCOME');
            if (fault === 'normal' && outcome.kind === 'success') {
              slowStreak = outcome.durationMs > 1000 ? slowStreak + 1 : 0;
              if (slowStreak >= 3) stop('THREE_SLOW_NORMAL_RESPONSES');
            }
          })();
          batch.push(task);
        }
        await Promise.all(batch);
      }
      phaseRecords.sort((a, b) => a.id - b.id);
      summaries.push(
        summarize(
          phase,
          phaseRecords,
          now() - phaseStart,
          phaseMax,
          guard() && index === phase.total,
        ),
      );
    }
  } catch {
    if (!reason) stop('HARNESS_ERROR');
  } finally {
    clearTimeout(deadline);
    signal?.removeEventListener('abort', interrupt);
    // Cancellation has settled each in-flight request before closing the owned server.
    try {
      await session?.close();
    } catch {
      stop('SERVER_CLEANUP_ERROR');
    }
  }
  for (const phase of phases.slice(summaries.length)) {
    const partial = records.filter((record) => record.phase === phase.name);
    const state = progress.get(phase.name);
    summaries.push(
      summarize(phase, partial, state ? now() - state.start : 0, state?.max ?? 0, false),
    );
  }
  records.sort((a, b) => a.id - b.id);
  const durationMs = now() - start;
  if (durationMs >= limits.durationMs) reason ??= 'GLOBAL_DURATION_LIMIT';
  return {
    status: reason
      ? 'incomplete'
      : summaries.every((phase) => phase.status === 'passed')
        ? 'passed'
        : 'failed',
    reason,
    planned: phases.reduce((sum, phase) => sum + phase.total, 0),
    started,
    completed: records.length,
    maxConcurrency,
    durationMs,
    phases: summaries,
    requests: records,
  };
}

module.exports = { runProfile };
