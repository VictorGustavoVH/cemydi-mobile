const { spawnSync } = require('node:child_process');
const { accessSync, constants, mkdirSync, statSync, writeFileSync } = require('node:fs');

function inspectDevice() {
  let stat;
  try {
    stat = statSync('/dev/kvm');
  } catch (error) {
    if (error.code === 'ENOENT') return { exists: false };
    throw error;
  }
  const accessible = (mode) => {
    try {
      accessSync('/dev/kvm', mode);
      return true;
    } catch {
      return false;
    }
  };
  return {
    exists: true,
    characterDevice: stat.isCharacterDevice(),
    mode: (stat.mode & 0o777).toString(8),
    uid: stat.uid,
    gid: stat.gid,
    readable: accessible(constants.R_OK),
    writable: accessible(constants.W_OK),
  };
}

function prepareKvm({ inspect, grantAccess, record = () => {} }) {
  const before = inspect();
  record({ stage: 'inspect-before', device: before });
  if (!before.exists || !before.characterDevice)
    throw new Error(
      '/dev/kvm no es un dispositivo de caracteres disponible; el runner necesita KVM.',
    );
  if (!before.readable || !before.writable) {
    record({ stage: 'grant-access', command: 'sudo -n chmod a+rw /dev/kvm' });
    grantAccess();
  }
  const after = inspect();
  record({ stage: 'inspect-after', device: after });
  if (!after.exists || !after.characterDevice || !after.readable || !after.writable)
    throw new Error('/dev/kvm sigue sin lectura/escritura después de preparar permisos.');
  return after;
}

if (require.main === module) {
  const report = {
    platform: process.platform,
    uid: process.getuid?.(),
    groups: process.getgroups?.(),
    commit: process.env.GITHUB_SHA,
    runId: process.env.GITHUB_RUN_ID,
    stages: [],
  };
  try {
    if (
      process.platform !== 'linux' ||
      process.env.GITHUB_ACTIONS !== 'true' ||
      process.env.RUNNER_ENVIRONMENT !== 'github-hosted'
    )
      throw new Error('La preparación KVM solo se permite en Linux GitHub-hosted.');
    prepareKvm({
      inspect: inspectDevice,
      record: (stage) => {
        report.stages.push(stage);
        console.log(JSON.stringify(stage));
      },
      grantAccess: () => {
        const result = spawnSync('sudo', ['-n', 'chmod', 'a+rw', '/dev/kvm'], {
          encoding: 'utf8',
          timeout: 15000,
        });
        if (result.error || result.status !== 0)
          throw new Error(
            `Falló chmod KVM (${result.status}): ${result.error?.message || result.stderr}`,
          );
      },
    });
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = error.message;
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    mkdirSync('test-results/maestro/ci', { recursive: true });
    writeFileSync('test-results/maestro/ci/kvm.json', JSON.stringify(report, null, 2));
  }
}
module.exports = { prepareKvm };
