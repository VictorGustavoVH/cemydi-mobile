const { execFile } = require('node:child_process');
const { Buffer } = require('node:buffer');
const { writeFileSync } = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { measured, unavailable } = require('./metrics.cjs');

// Only the exact main-process row leaves memory. CPU is the Android reporting
// window, which can overlap the route or a previous sample.
function cpuWindow(text, pid, elapsedSinceRouteStartMs) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return unavailable('PID CPU no verificable.');
  const windows = [...text.matchAll(/^CPU usage from (\d+)ms to (\d+)ms ago\b/gm)];
  const rows = [...text.matchAll(/^\s*([0-9]+(?:\.[0-9]+)?)%\s+(\d+)\/com\.cemydi\.app:\s/gm)];
  if (windows.length !== 1 || rows.length !== 1 || Number(rows[0][2]) !== pid)
    return unavailable('Ventana CPU o proceso principal ausente, ambiguo o cambiado.');
  const fromMsAgo = Number(windows[0][1]);
  const toMsAgo = Number(windows[0][2]);
  const percent = Number(rows[0][1]);
  if (
    ![fromMsAgo, toMsAgo].every(Number.isSafeInteger) ||
    fromMsAgo <= toMsAgo ||
    !Number.isFinite(percent)
  )
    return unavailable('Ventana CPU inválida.');
  if (!Number.isFinite(elapsedSinceRouteStartMs) || elapsedSinceRouteStartMs < fromMsAgo)
    return unavailable('Ventana CPU anterior o parcialmente anterior al recorrido; dato antiguo.');
  return measured({ pid, percent, fromMsAgo, toMsAgo, source: 'dumpsys-cpuinfo-main-process' });
}

function traceArgs(serial, seconds, remoteFile) {
  if (!/^[\w.:-]+$/.test(serial) || !Number.isInteger(seconds) || seconds < 10 || seconds > 620)
    throw new Error('Parámetros de traza inválidos.');
  if (!/^\/data\/misc\/perfetto-traces\/cemydi-[a-f0-9-]+\.perfetto-trace$/.test(remoteFile))
    throw new Error('Ruta de traza remota inválida.');
  return ['-s', serial, 'shell', '-T', 'perfetto', '-o', remoteFile, '--txt', '-c', '-'];
}

function traceConfig(seconds) {
  return `duration_ms: ${seconds * 1000}
write_into_file: true
file_write_period_ms: 1000
max_file_size_bytes: 134217728
buffers { size_kb: 32768 fill_policy: RING_BUFFER }
buffers { size_kb: 4096 fill_policy: RING_BUFFER }
incremental_state_config { clear_period_ms: 5000 }
data_sources {
  config {
    name: "linux.ftrace"
    ftrace_config {
      ftrace_events: "sched/sched_switch"
      ftrace_events: "sched/sched_wakeup"
      ftrace_events: "task/task_newtask"
      ftrace_events: "sched/sched_process_exit"
      ftrace_events: "ftrace/print"
      atrace_categories: "gfx"
      atrace_categories: "view"
      atrace_apps: "com.cemydi.app"
    }
  }
}
data_sources {
  config {
    name: "linux.process_stats"
    target_buffer: 1
    process_stats_config {
      scan_all_processes_on_start: true
      record_thread_names: true
      proc_stats_poll_ms: 1000
      proc_stats_cache_ttl_ms: 1000
    }
  }
}
`;
}

// Validate protobuf framing and at least one timestamped ftrace event.
// This does not certify trace coverage or absence of dropped events.
function protobufFields(buffer) {
  let offset = 0;
  const fields = [];
  function varint() {
    let value = 0n;
    for (let shift = 0n; shift < 70n && offset < buffer.length; shift += 7n) {
      const byte = buffer[offset++];
      value |= BigInt(byte & 127) << shift;
      if (byte < 128) return value;
    }
    throw new Error(`Varint protobuf truncado en offset ${offset}.`);
  }
  while (offset < buffer.length) {
    const tag = varint();
    const field = Number(tag >> 3n);
    const wire = Number(tag & 7n);
    if (field < 1 || field > 536870911)
      throw new Error(`Campo protobuf inválido en offset ${offset}.`);
    let value;
    if (wire === 0) value = varint();
    else {
      const length = wire === 2 ? Number(varint()) : { 1: 8, 5: 4 }[wire];
      if (!Number.isSafeInteger(length) || length < 0 || length > buffer.length - offset)
        throw new Error(`Longitud/wire protobuf inválido en offset ${offset}, wire ${wire}.`);
      value = buffer.subarray(offset, offset + length);
      offset += length;
    }
    fields.push({ field, wire, value });
  }
  return fields;
}

function inspectTrace(buffer) {
  const report = {
    valid: false,
    stage: 'trace',
    packets: 0,
    bundles: 0,
    events: 0,
    lostBundles: 0,
    nonBootClockBundles: 0,
    compactBundles: 0,
    cpuRanges: [],
  };
  const ranges = new Map();
  try {
    if (!Buffer.isBuffer(buffer) || !buffer.length) {
      report.reason = 'Salida vacía o no binaria.';
      return report;
    }
    const packets = protobufFields(buffer);
    report.packets = packets.length;
    if (!packets.length || packets.some((p) => p.field !== 1 || p.wire !== 2)) {
      report.reason = 'El contenedor Trace contiene campos distintos de packet.';
      return report;
    }
    let hasEvent = false;
    for (const packet of packets) {
      report.stage = 'packet';
      const fields = protobufFields(packet.value);
      for (const bundle of fields.filter((p) => p.field === 1 && p.wire === 2)) {
        report.bundles++;
        report.stage = 'ftrace-bundle';
        const bundleFields = protobufFields(bundle.value);
        if (bundleFields.some((p) => p.field === 3 && p.wire === 0 && p.value !== 0n))
          report.lostBundles++;
        if (bundleFields.some((p) => p.field === 5 && p.wire === 0 && p.value !== 0n))
          report.nonBootClockBundles++;
        if (bundleFields.some((p) => p.field === 4 && p.wire === 2)) report.compactBundles++;
        const cpu = bundleFields.find((p) => p.field === 1 && p.wire === 0)?.value;
        for (const event of bundleFields.filter((p) => p.field === 2 && p.wire === 2)) {
          report.events++;
          report.stage = 'ftrace-event';
          const fields = protobufFields(event.value);
          const timestamp = fields.find((p) => p.field === 1 && p.wire === 0)?.value;
          if (cpu !== undefined && timestamp > 0n) {
            const seconds = Number(timestamp) / 1e9;
            const key = Number(cpu);
            const range = ranges.get(key) ?? {
              cpu: key,
              firstSeconds: seconds,
              lastSeconds: seconds,
            };
            range.firstSeconds = Math.min(range.firstSeconds, seconds);
            range.lastSeconds = Math.max(range.lastSeconds, seconds);
            ranges.set(key, range);
          }
          if (
            fields.some((p) => p.field === 1 && p.wire === 0 && p.value > 0n) &&
            fields.some((p) => p.field > 2 && p.wire === 2)
          )
            hasEvent = true;
        }
      }
    }
    report.valid = hasEvent;
    report.cpuRanges = [...ranges.values()].sort((a, b) => a.cpu - b.cpu);
    report.stage = 'complete';
    if (!hasEvent) report.reason = 'Sin evento ftrace con timestamp y payload verificables.';
  } catch (error) {
    report.reason = error.message;
  }
  return report;
}

function routeCoverage(report, startUptime, endUptime) {
  const start = Number(startUptime);
  const end = Number(endUptime);
  if (
    !report?.valid ||
    !startUptime ||
    !endUptime ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end <= start
  )
    return unavailable('Traza o límites temporales no verificables.');
  if (
    !Array.isArray(report.cpuRanges) ||
    !report.cpuRanges.length ||
    report.nonBootClockBundles ||
    report.compactBundles
  )
    return unavailable(
      'Faltan rangos por CPU o el reloj/encoding requiere análisis especializado.',
    );
  if (report.lostBundles) return unavailable('La traza declara pérdida de eventos ftrace.');
  const missing = report.cpuRanges
    .filter((cpu) => cpu.firstSeconds > start || cpu.lastSeconds < end)
    .map((cpu) => cpu.cpu);
  if (missing.length)
    return unavailable(
      `Falta inicio o final del recorrido en las CPU observadas: ${missing.join(', ')}.`,
    );
  return {
    status: 'review-required',
    boundsCovered: true,
    reason:
      'Límites cubiertos en CPU observadas; revisar estadísticas de pérdida, identidad y fuentes antes de calcular CPU/FPS.',
  };
}

function validTrace(buffer) {
  return inspectTrace(buffer).valid;
}

// Config travels through shell stdin. Binary data travels through exec-out cat,
// since some OEM shells apply ONLCR even with -T. Keep the unique remote file
// for reproducibility; never delete or overwrite a previous trace.
function startTrace(
  serial,
  seconds,
  dir,
  repetition,
  signal,
  run = execFile,
  now = () => performance.now(),
) {
  const remoteFile = `/data/misc/perfetto-traces/cemydi-${randomUUID()}.perfetto-trace`;
  const args = traceArgs(serial, seconds, remoteFile);
  const transferArgs = ['-s', serial, 'exec-out', 'cat', remoteFile];
  const basename = `repetition-${repetition}.perfetto-trace`;
  const startedAt = new Date().toISOString();
  const started = now();
  return new Promise((resolve) => {
    const child = run(
      process.env.CEMYDI_ADB || 'adb',
      args,
      {
        encoding: 'buffer',
        timeout: (seconds + 25) * 1000,
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
        signal,
      },
      async (error, stdout) => {
        const recordingElapsedMs = now() - started;
        const recordingStdoutBytes = Buffer.isBuffer(stdout) ? stdout.length : 0;
        let transferAttempted = false;
        if (!error && !signal.aborted && recordingElapsedMs >= (seconds - 1) * 1000) {
          transferAttempted = true;
          const transfer = await new Promise((done) => {
            run(
              process.env.CEMYDI_ADB || 'adb',
              transferArgs,
              {
                encoding: 'buffer',
                timeout: 60000,
                maxBuffer: 160 * 1024 * 1024,
                windowsHide: true,
                signal,
              },
              (transferError, data) => done({ error: transferError, data }),
            );
          });
          error = transfer.error;
          stdout = transfer.data;
        } else stdout = Buffer.alloc(0);
        const elapsedMs = now() - started;
        const validation = inspectTrace(stdout);
        const binaryValid = validation.valid;
        const info = {
          status: 'failed',
          startedAt,
          finishedAt: new Date().toISOString(),
          durationSeconds: seconds,
          config: traceConfig(seconds),
          elapsedMs,
          recordingElapsedMs,
          remoteFile,
          command: ['adb', ...args],
          transferCommand: ['adb', ...transferArgs],
          diagnostics: {
            stdoutBytes: Buffer.isBuffer(stdout) ? stdout.length : 0,
            recordingStdoutBytes,
            transferAttempted,
            validProtobufWithEvents: binaryValid,
            cancelled: signal.aborted,
            timedOut: Boolean(error?.killed && !signal.aborted),
            exitCode: Number.isInteger(error?.code) ? error.code : null,
            processError: Boolean(error),
            validation,
          },
        };
        if (signal.aborted) info.reason = 'Traza cancelada.';
        else if (info.diagnostics.timedOut) info.reason = 'Timeout esperando a Perfetto/ADB.';
        else if (error) info.reason = 'Falló el proceso Perfetto/ADB; consultar diagnostics.';
        else if (!binaryValid) info.reason = 'Salida sin protobuf válido con eventos ftrace.';
        else if (recordingElapsedMs < (seconds - 1) * 1000)
          info.reason = 'Perfetto terminó antes de la duración configurada.';
        try {
          if (info.reason && Buffer.isBuffer(stdout) && stdout.length) {
            const rawFile = `repetition-${repetition}.unvalidated.bin`;
            writeFileSync(path.join(dir, rawFile), stdout, { flag: 'wx' });
            info.unvalidatedOutput = {
              file: rawFile,
              bytes: stdout.length,
              sha256: createHash('sha256').update(stdout).digest('hex'),
              status: 'unvalidated',
            };
          }
          if (info.reason) throw new Error('Perfetto falló, fue cancelado o no devolvió datos.');
          writeFileSync(path.join(dir, basename), stdout, { flag: 'wx' });
          Object.assign(info, {
            status: 'captured',
            file: basename,
            bytes: stdout.length,
            sha256: createHash('sha256').update(stdout).digest('hex'),
            analysis: 'pending; verificar fuentes, límites del recorrido y pérdida de eventos',
          });
        } catch {
          info.reason ??= 'No se pudo escribir la traza con creación exclusiva.';
        }
        try {
          writeFileSync(
            path.join(dir, `repetition-${repetition}-trace.json`),
            JSON.stringify(info, null, 2) + '\n',
            { flag: 'wx' },
          );
        } catch {
          info.status = 'failed';
          info.reason = 'No se pudo conservar metadata exclusiva de la traza.';
        }
        resolve(info);
      },
    );
    child.stdin.on('error', () => {}); // execFile callback records process/pipe failures.
    child.stdin.end(traceConfig(seconds));
  });
}

module.exports = {
  protobufFields,
  cpuWindow,
  traceArgs,
  traceConfig,
  inspectTrace,
  routeCoverage,
  validTrace,
  startTrace,
};
