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
  if ! adb -s "$ANDROID_SERIAL" shell dumpsys activity lastanr > test-results/maestro/ci/lastanr-after.txt 2>&1; then
    echo 'No se pudo recoger el último ANR del emulador.' >&2
  fi
  exit "$status"
}
trap finish EXIT

# boot_completed alone does not mean first-boot package work has finished.
# Android 35 supports bounded waits on both Package Manager handlers.
adb -s "$ANDROID_SERIAL" shell wm size 720x1600
adb -s "$ANDROID_SERIAL" shell wm density 320
adb -s "$ANDROID_SERIAL" shell cmd package wait-for-handler --timeout 60000
adb -s "$ANDROID_SERIAL" shell cmd package wait-for-background-handler --timeout 60000
adb -s "$ANDROID_SERIAL" shell dumpsys activity lastanr > test-results/maestro/ci/lastanr-before.txt
if grep -q 'ANR time:' test-results/maestro/ci/lastanr-before.txt; then
  echo 'El emulador ya tiene un ANR antes de instalar CEMYDI. Consulta lastanr-before.txt.' >&2
  exit 1
fi
adb -s "$ANDROID_SERIAL" logcat -c
adb -s "$ANDROID_SERIAL" install test-results/apk/app-debug.apk
export CEMYDI_E2E_DEVICE="$ANDROID_SERIAL"
export CEMYDI_E2E_ALLOW_CLEAR="$ANDROID_SERIAL"
npm run test:e2e
