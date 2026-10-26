#!/usr/bin/env bash
set -euo pipefail

# The workflow authorizes clearing only its fresh, GitHub-hosted emulator.
# Local devices continue to require the explicit opt-in in MAESTRO_E2E.md.
if [[ "${GITHUB_ACTIONS:-}" != 'true' || "${RUNNER_ENVIRONMENT:-}" != 'github-hosted' || "${ANDROID_SERIAL:-}" != 'emulator-5554' ]]; then
  echo 'Este script requiere el emulador desechable de GitHub Actions.' >&2
  exit 1
fi

if [[ "$(adb -s "$ANDROID_SERIAL" shell getprop ro.kernel.qemu | tr -d '\r')" != '1' ]]; then
  echo 'El dispositivo seleccionado no se reconoce como emulador.' >&2
  exit 1
fi

mkdir -p test-results/maestro/ci
finish() {
  local status=$?
  trap - EXIT
  if ! adb -s "$ANDROID_SERIAL" logcat -d > test-results/maestro/ci/logcat.log 2>&1; then
    echo 'No se pudo recoger logcat del emulador.' >&2
  fi
  exit "$status"
}
trap finish EXIT

adb -s "$ANDROID_SERIAL" logcat -c
adb -s "$ANDROID_SERIAL" install test-results/apk/app-debug.apk
export CEMYDI_E2E_DEVICE="$ANDROID_SERIAL"
export CEMYDI_E2E_ALLOW_CLEAR="$ANDROID_SERIAL"
npm run test:e2e
