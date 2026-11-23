const { measured, unavailable } = require('./metrics.cjs');

// Only the application's main activity buffer layer. Never guess between layers,
// or pass arbitrary dumpsys output to the Android shell.
function selectLayer(text) {
  const layers = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^com\.cemydi\.app\/com\.cemydi\.app\.MainActivity(?:#[0-9]+)?$/.test(line));
  return layers.length === 1 ? layers[0] : null;
}

function latency(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!/^\d+$/.test(lines[0])) return unavailable('Sin cabecera SurfaceFlinger válida.');
  const refreshNs = Number(lines.shift());
  if (!Number.isSafeInteger(refreshNs) || refreshNs <= 0)
    return unavailable('Periodo de refresco inválido.');
  const frames = [];
  const records = [];
  let pending = false;
  for (const line of lines.filter(Boolean)) {
    if (!/^\d+\s+\d+\s+\d+$/.test(line)) return unavailable('Fila de presentación inválida.');
    const values = line.split(/\s+/).map(BigInt);
    if (values.every((value) => value === 0n)) continue;
    const sentinel = 9223372036854775807n;
    if (
      values.some(
        (value) => value <= 0n || (value !== sentinel && value > BigInt(Number.MAX_SAFE_INTEGER)),
      )
    )
      return unavailable('Timestamp de presentación inválido.');
    // Only the second column is the actual presentation fence. A pending
    // ready fence must not discard an already known actual presentation.
    const desiredNs = values[0] === sentinel ? null : Number(values[0]);
    const actualPresentNs = values[1] === sentinel ? null : Number(values[1]);
    const key =
      desiredNs === null
        ? actualPresentNs === null
          ? null
          : `present:${actualPresentNs}`
        : `desired:${desiredNs}`;
    if (key === null || records.some((record) => record.key === key))
      return unavailable('Identidad de frame ausente o duplicada.');
    records.push({
      key,
      desiredNs,
      actualPresentNs,
      readyNs: values[2] === sentinel ? null : Number(values[2]),
    });
    if (actualPresentNs === null) {
      pending = true;
      continue;
    }
    const present = Number(values[1]);
    if (frames.length && present <= frames.at(-1))
      return unavailable('Presentaciones duplicadas o desordenadas.');
    frames.push(present);
  }
  return measured({ refreshNs, frames, pending, records });
}

function presentationSummary(samples, sameLayer, resolutions = []) {
  if (!sameLayer || samples.length < 2 || samples.some((sample) => sample.status !== 'measured'))
    return unavailable('Capa ausente/cambiada o muestras de presentación incompletas.');
  const baseline = new Set(samples[0].value.frames);
  const seen = new Set();
  const identified = new Map();
  const baselineIds = new Set(samples[0].value.records?.map((record) => record.key));
  const hasRecords = samples.every((sample) => Array.isArray(sample.value.records));
  const merge = (record) => {
    const previous = identified.get(record.key);
    if (
      previous?.actualPresentNs !== null &&
      previous?.actualPresentNs !== undefined &&
      record.actualPresentNs !== null &&
      previous.actualPresentNs !== record.actualPresentNs
    )
      return false;
    if (!previous || record.actualPresentNs !== null) identified.set(record.key, record);
    return true;
  };
  let previous;
  for (const sample of samples) {
    const current = sample.value;
    if (current.refreshNs !== samples[0].value.refreshNs || !current.frames.length)
      return unavailable('Sin frames de referencia o cambió el refresco.');
    if (previous && !current.frames.some((frame) => previous.frames.includes(frame)))
      return unavailable('Sin solapamiento: posible pérdida o reinicio del buffer SurfaceFlinger.');
    if (previous && current.frames.at(-1) < previous.frames.at(-1))
      return unavailable('Retroceso del buffer de presentación.');
    current.frames.forEach((frame) => seen.add(frame));
    if (hasRecords && current.records.some((record) => !merge(record)))
      return unavailable('Cambió el timestamp de presentación de un frame identificado.');
    previous = current;
  }
  if (hasRecords) {
    for (const sample of resolutions) {
      if (
        sample.status !== 'measured' ||
        sample.value.refreshNs !== previous.refreshNs ||
        !Array.isArray(sample.value.records)
      )
        return unavailable('Resolución de fences ausente o incompatible.');
      // Follow-up samples only resolve identities seen during the route. Never
      // add new frames produced during stabilization to the FPS window.
      for (const record of sample.value.records)
        if (identified.has(record.key) && !merge(record))
          return unavailable('Identidad de presentación inconsistente al resolver fences.');
    }
    const route = [...identified.values()].filter((record) => !baselineIds.has(record.key));
    if (route.some((record) => record.actualPresentNs === null))
      return unavailable('Fences de presentación del recorrido sin resolver o sobrescritos.');
    seen.clear();
    route.forEach((record) => seen.add(record.actualPresentNs));
  } else if (samples.some((sample) => sample.value.pending)) {
    return unavailable('Fences pendientes sin identidad; evidencia histórica insuficiente.');
  }
  const frames = [...seen]
    .filter((frame) => !baseline.has(frame) && frame > samples[0].value.frames.at(-1))
    .sort((a, b) => a - b);
  if (frames.length < 2) return unavailable('Faltan dos presentaciones nuevas para calcular FPS.');
  const windowSeconds = (frames.at(-1) - frames[0]) / 1e9;
  return measured({
    source: 'surfaceflinger-actual-present-main-activity',
    frames: frames.length,
    windowSeconds,
    averageFps: (frames.length - 1) / windowSeconds,
    scope:
      'ventana entre primera y última presentación nueva; incluye pausas intermedias, excluye reposo inicial/final; no es el promedio de los 30s',
  });
}

module.exports = { selectLayer, latency, presentationSummary };
