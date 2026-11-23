// The first three counters belong to the service lifetime, not this session.
// Buffer counters are session-specific. Never treat old service totals as
// missing events in a new session if every snapshot has the same total.
function checkLoss(service, kernel, cpuIds) {
  const reasons = [];
  let increased = false;
  let initialNonzero = false;
  let bufferInitialNonzero = false;
  if (service.length < 2) reasons.push('faltan snapshots inicial/final del servicio');
  if (service.some((snapshot) => snapshot.length < 8))
    reasons.push('faltan estadísticas de buffers del servicio');
  for (let index = 0; index < service.length; index++) {
    const current = service[index];
    const previous = service[index - 1];
    if (index === 0) {
      initialNonzero = current.slice(0, 3).some((value) => value > 0);
      bufferInitialNonzero = current.slice(3).some((value) => value > 0);
    }
    if (
      previous &&
      (current.length !== previous.length ||
        current.some((value, column) => value < previous[column]))
    )
      reasons.push('contadores del servicio reiniciados o buffers cambiados');
    if (previous && current.some((value, column) => value > previous[column])) increased = true;
  }
  if (increased) reasons.push('aumentaron contadores de pérdida del servicio durante la traza');
  if (bufferInitialNonzero)
    reasons.push('pérdida inicial del buffer de esta sesión sin localización temporal verificable');
  let kernelIncreased = false;
  for (const cpu of cpuIds) {
    const start = kernel.start.get(cpu);
    const end = kernel.end.get(cpu);
    if (!start || !end) {
      reasons.push('faltan estadísticas inicial/final de kernel por CPU');
      continue;
    }
    if (end.some((value, index) => value < start[index]))
      reasons.push('contadores del kernel reiniciados');
    if (end.some((value, index) => value > start[index])) kernelIncreased = true;
  }
  if (kernelIncreased) reasons.push('aumentaron overrun/commit_overrun/dropped_events del kernel');
  return {
    verified: reasons.length === 0,
    serviceIncreased: increased,
    serviceInitialNonzero: initialNonzero,
    sessionBufferInitialNonzero: bufferInitialNonzero,
    kernelIncreased,
    reasons: [...new Set(reasons)],
  };
}

module.exports = { checkLoss };
