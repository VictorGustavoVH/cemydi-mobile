const { execFile } = require('node:child_process');

function graphicsScript(seconds) {
  if (!Number.isInteger(seconds) || seconds < 10 || seconds > 620)
    throw new Error('Duración gráfica inválida.');
  // Fixed package and commands only. /proc/uptime also bounds the remote loop
  // if the host is interrupted. No files, resets, input or app launches.
  return `read up rest < /proc/uptime
end=$((\${up%.*} + ${seconds} + 1))
while [ "\${up%.*}" -lt "$end" ]; do
printf '\\nCEMYDI_GFX_BEGIN %s\\n' "$up"
dumpsys gfxinfo com.cemydi.app framestats
read up rest < /proc/uptime
printf '\\nCEMYDI_GFX_END %s\\n' "$up"
sleep 0.01
read up rest < /proc/uptime
done`;
}

function parseGraphicsStream(text, start, end, parse) {
  const samples = [];
  const pattern = /CEMYDI_GFX_BEGIN (\d+\.\d+)\r?\n([\s\S]*?)\r?\nCEMYDI_GFX_END (\d+\.\d+)/g;
  for (const match of text.matchAll(pattern)) {
    const begin = Number(match[1]);
    const finish = Number(match[3]);
    if (begin >= Number(start) && finish <= Number(end) && finish >= begin)
      samples.push({ ...parse(match[2]), deviceStartSeconds: begin, deviceEndSeconds: finish });
  }
  return samples;
}

function afterBaseline(samples, before) {
  if (before.counters.status !== 'measured') return samples;
  let first = 0;
  while (
    first < samples.length &&
    samples[first].counters.status === 'measured' &&
    JSON.stringify(samples[first].source) === JSON.stringify(before.source) &&
    samples[first].counters.value.total < before.counters.value.total
  )
    first++;
  return samples.slice(first);
}

function startGraphicsStream(serial, seconds, signal, run = execFile) {
  if (!/^[\w.:-]+$/.test(serial)) throw new Error('Serial gráfico inválido.');
  const script = graphicsScript(seconds);
  return new Promise((resolve) => {
    const child = run(
      process.env.CEMYDI_ADB || 'adb',
      ['-s', serial, 'shell', '-T', 'sh'],
      {
        encoding: 'utf8',
        timeout: (seconds + 15) * 1000,
        maxBuffer: 32 * 1024 * 1024,
        windowsHide: true,
        signal,
      },
      (error, stdout) => resolve({ status: error ? 'failed' : 'captured', text: stdout ?? '' }),
    );
    child.stdin.on('error', () => {});
    child.stdin.end(script + '\n');
  });
}

module.exports = { graphicsScript, parseGraphicsStream, startGraphicsStream, afterBaseline };
