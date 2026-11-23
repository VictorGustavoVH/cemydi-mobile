const { protobufFields, inspectTrace, routeCoverage } = require('./native-trace.cjs');
const { unavailable } = require('./metrics.cjs');
const { checkLoss } = require('./trace-loss.cjs');

const integerField = (fields, id) => {
  const value = Number(fields.find((field) => field.field === id && field.wire === 0)?.value ?? 0n);
  if (!Number.isSafeInteger(value)) throw new Error('Campo CPU fuera de rango.');
  return value;
};

// Reconstruct running intervals, clipped to the route. Unknown TIDs never get
// attributed by thread name. Percent uses one logical CPU as 100%.
function analyzeCpu(buffer, pid, startUptime, endUptime) {
  try {
    const coverage = routeCoverage(inspectTrace(buffer), startUptime, endUptime);
    if (!coverage.boundsCovered) return { process: unavailable(coverage.reason) };
    const start = Number(startUptime);
    const end = Number(endUptime);
    const owners = new Map();
    const schedules = new Map();
    let processVerified = false;
    let ownerConflict = false;
    const service = [];
    const kernel = { start: new Map(), end: new Map() };
    const births = [];
    const createdAt = new Map();
    const exitEvents = new Set();
    const addOwner = (tid, owner) => {
      if (!tid || !owner) return;
      const previous = owners.get(tid);
      if (previous !== undefined && previous !== owner) ownerConflict = true;
      owners.set(tid, owner);
    };
    for (const packet of protobufFields(buffer)) {
      const fields = protobufFields(packet.value);
      for (const tree of fields.filter((field) => field.field === 2 && field.wire === 2))
        for (const entry of protobufFields(tree.value)) {
          if (entry.wire !== 2 || ![1, 2].includes(entry.field)) continue;
          const values = protobufFields(entry.value);
          const tid = integerField(values, 1);
          if (entry.field === 2) addOwner(tid, integerField(values, 3));
          else {
            addOwner(tid, tid);
            if (
              tid === pid &&
              values.some(
                (field) =>
                  field.field === 3 &&
                  field.wire === 2 &&
                  field.value.toString() === 'com.cemydi.app',
              )
            )
              processVerified = true;
          }
        }
      for (const stats of fields.filter((field) => field.field === 35 && field.wire === 2)) {
        const values = protobufFields(stats.value);
        const snapshot = [8, 9, 10].map((id) => integerField(values, id));
        for (const stat of values.filter((field) => field.field === 1 && field.wire === 2)) {
          const counters = protobufFields(stat.value);
          snapshot.push(...[3, 6, 13, 18, 19].map((id) => integerField(counters, id)));
        }
        service.push(snapshot);
      }
      for (const stats of fields.filter((field) => field.field === 34 && field.wire === 2)) {
        const values = protobufFields(stats.value);
        const phase = integerField(values, 1);
        if (![1, 2].includes(phase)) continue;
        for (const cpu of values.filter((field) => field.field === 2 && field.wire === 2)) {
          const counters = protobufFields(cpu.value);
          const id = integerField(counters, 1);
          const target = phase === 1 ? kernel.start : kernel.end;
          if (phase === 1 && target.has(id)) continue;
          target.set(
            id,
            [3, 4, 8].map((field) => integerField(counters, field)),
          );
        }
      }
      for (const bundle of fields.filter((field) => field.field === 1 && field.wire === 2)) {
        const values = protobufFields(bundle.value);
        const cpu = integerField(values, 1);
        const switches = schedules.get(cpu) ?? [];
        for (const event of values.filter((field) => field.field === 2 && field.wire === 2)) {
          const fields = protobufFields(event.value);
          const time = integerField(fields, 1) / 1e9;
          for (const value of fields.filter((field) => field.field === 235 && field.wire === 2)) {
            const task = protobufFields(value.value);
            const flags = task.find((field) => field.field === 3 && field.wire === 0)?.value;
            if (flags !== undefined)
              births.push({
                tid: integerField(task, 1),
                parent: integerField(fields, 2),
                thread: (flags & 65536n) !== 0n,
                time,
              });
          }
          for (const value of fields.filter((field) => field.field === 238 && field.wire === 2)) {
            const tid = integerField(protobufFields(value.value), 2);
            if (tid) exitEvents.add(tid);
          }
          for (const value of fields.filter((field) => field.field === 4 && field.wire === 2)) {
            const sched = protobufFields(value.value);
            switches.push({
              time: integerField(fields, 1) / 1e9,
              previous: integerField(sched, 2),
              next: integerField(sched, 6),
            });
          }
        }
        schedules.set(cpu, switches);
      }
    }
    births.sort((a, b) => a.time - b.time);
    for (const birth of births) {
      if (createdAt.has(birth.tid) && createdAt.get(birth.tid) !== birth.time) ownerConflict = true;
      createdAt.set(birth.tid, birth.time);
      const owner = birth.thread ? owners.get(birth.parent) : birth.tid;
      if (owner) addOwner(birth.tid, owner);
    }
    if (!processVerified || ownerConflict)
      return {
        process: unavailable(
          !processVerified
            ? 'ProcessTree no conserva la identidad del proceso de CEMYDI en esta traza.'
            : 'Pertenencia de hilos ambigua o TID reutilizado.',
        ),
        diagnostics: { pid, processVerified, ownerConflict, lifecycleBirths: births.length },
      };
    let runningSeconds = 0;
    let mainSeconds = 0;
    let gaps = 0;
    let missingBounds = false;
    const unclassified = new Set();
    const attributed = new Set();
    for (const switches of schedules.values()) {
      switches.sort((a, b) => a.time - b.time);
      if (!switches.length || switches[0].time > start || switches.at(-1).time < end)
        missingBounds = true;
      for (let index = 1; index < switches.length; index++) {
        const previous = switches[index - 1];
        const current = switches[index];
        const duration = Math.min(end, current.time) - Math.max(start, previous.time);
        if (duration <= 0) continue;
        if (previous.next !== current.previous) gaps++;
        // do_exit can block, resume and consume CPU after sched_process_exit.
        // Only a new birth denotes a new lifetime; ambiguous reuse is rejected.
        const lifetimeKnown =
          Math.max(start, previous.time) >= (createdAt.get(previous.next) ?? -Infinity);
        if (previous.next && (!owners.has(previous.next) || !lifetimeKnown))
          unclassified.add(previous.next);
        if (lifetimeKnown && owners.get(previous.next) === pid) {
          runningSeconds += duration;
          attributed.add(previous.next);
          if (previous.next === pid) mainSeconds += duration;
        }
      }
    }
    const reasons = [];
    if (missingBounds) reasons.push('sched_switch no cubre los límites en todas las CPU');
    if (gaps) reasons.push('discontinuidades en sched_switch');
    const loss = checkLoss(service, kernel, [...schedules.keys()]);
    reasons.push(...loss.reasons);
    if (unclassified.size) reasons.push('hay TID programados sin pertenencia verificable');
    const diagnostics = {
      pid,
      observedCpus: schedules.size,
      attributedThreads: attributed.size,
      unclassifiedThreads: unclassified.size,
      gaps,
      missingBounds,
      serviceStats: service.length,
      lifecycleBirths: births.length,
      lifecycleExits: exitEvents.size,
      loss,
    };
    const value = {
      source: 'perfetto-sched-switch',
      windowSeconds: end - start,
      cpuMilliseconds: runningSeconds * 1000,
      percentOfOneCpu: (100 * runningSeconds) / (end - start),
      mainThreadCpuMilliseconds: mainSeconds * 1000,
      scope: 'solo hilos identificados; 100% equivale a una CPU lógica',
    };
    return {
      process: reasons.length ? unavailable(reasons.join('; ')) : { status: 'measured', value },
      observedIdentifiedThreads: {
        status: 'review-required',
        ...value,
        reason:
          'Reconstrucción de intervalos presentes; no equivale al total del proceso si hay pérdida o TID desconocidos.',
      },
      diagnostics,
    };
  } catch {
    return { process: unavailable('Traza CPU inválida o no compatible.') };
  }
}

module.exports = { analyzeCpu };
