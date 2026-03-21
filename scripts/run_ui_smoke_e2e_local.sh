#!/usr/bin/env bash
set -euo pipefail

HOST="127.0.0.1"
PORT="${PORT:-3100}"
BASE_URL="http://${HOST}:${PORT}"
LOG_FILE="${TMPDIR:-/tmp}/stillframe_ui_smoke_server_${PORT}.log"
SERVER_PID=""

port_in_use() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${port}" -sTCP:LISTEN -t >/dev/null 2>&1
    return $?
  fi
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "( sport = :${port} )" 2>/dev/null | tail -n +2 | grep -q .
    return $?
  fi
  if command -v netstat >/dev/null 2>&1; then
    netstat -an 2>/dev/null | grep -E "[\.:]${port}[[:space:]].*LISTEN" >/dev/null
    return $?
  fi
  return 1
}

cleanup() {
  if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if port_in_use "${PORT}"; then
  echo "PORT_IN_USE: ${PORT} is already listening. Stop it or run with PORT=<free-port>."
  exit 1
fi

echo "[ui-smoke-local] build (E2E=1)"
E2E=1 npm run build

echo "[ui-smoke-local] start server: ${BASE_URL}"
E2E=1 npm start -- --hostname "${HOST}" --port "${PORT}" >"${LOG_FILE}" 2>&1 &
SERVER_PID=$!

echo "[ui-smoke-local] wait for server readiness"
if ! node - "${BASE_URL}" <<'NODE'
const baseUrl = process.argv[2];
const deadline = Date.now() + 90_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/version`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) process.exit(0);
    } catch {
      // Ignore until timeout.
    }
    await sleep(1000);
  }
  process.exit(1);
})();
NODE
then
  echo "SERVER_NOT_READY: ${BASE_URL} did not become ready. See ${LOG_FILE}."
  exit 1
fi

echo "[ui-smoke-local] run smoke"
E2E=1 BASE_URL="${BASE_URL}" node scripts/app_ui_smoke.mjs
