function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const low = Math.floor(position);
  return sorted[low] + (sorted[Math.ceil(position)] - sorted[low]) * (position - low);
}

function summarize(phase, records, durationMs, maxConcurrency, finished) {
  const count = (predicate) => records.filter(predicate).length;
  const latencies = records.map((record) => record.durationMs);
  const unexpected = count((record) => !record.expected);
  const http503 = count((record) => record.status === 503);
  const timeouts = count((record) => record.kind === 'timeout');
  const p95 = percentile(latencies, 0.95);
  const recovery =
    phase.name !== 'faults' ||
    records.some((record) => record.recovery && record.kind === 'success' && record.expected);
  const rate = records.every(
    (record) =>
      count(
        (other) => other.offsetMs >= record.offsetMs && other.offsetMs < record.offsetMs + 1000,
      ) <= phase.rate,
  );
  const criteria = {
    complete: finished && records.length === phase.total,
    zeroUnexpected: unexpected === 0,
    concurrency: maxConcurrency <= phase.concurrency,
    rate,
    latency: phase.name === 'faults' || (p95 !== null && p95 < 500),
    programmedFaults: phase.name !== 'faults' || (http503 === 2 && timeouts === 2),
    recovery,
    noRetries: new Set(records.map((record) => record.id)).size === records.length,
  };
  return {
    name: phase.name,
    planned: phase.total,
    started: records.length,
    // Completed means terminal outcome, including timeout/cancellation, not HTTP success.
    completed: records.length,
    successful: count((record) => record.kind === 'success'),
    responsesConsumed: count((record) => record.kind === 'success' || record.kind === 'http'),
    httpErrors: count((record) => record.kind === 'http'),
    transportFailures: count((record) => record.kind === 'transport'),
    timeouts,
    cancelled: count((record) => record.kind === 'cancelled'),
    expectedErrors: count((record) => record.expected && record.kind !== 'success'),
    unexpectedErrors: unexpected,
    maxConcurrency,
    latencyMs: {
      min: latencies.length ? Math.min(...latencies) : null,
      median: percentile(latencies, 0.5),
      p95,
      max: latencies.length ? Math.max(...latencies) : null,
    },
    durationMs,
    requestsPerSecond: durationMs > 0 ? records.length / (durationMs / 1000) : 0,
    criteria,
    status: !criteria.complete
      ? 'incomplete'
      : Object.values(criteria).every(Boolean)
        ? 'passed'
        : 'failed',
  };
}

module.exports = { percentile, summarize };
