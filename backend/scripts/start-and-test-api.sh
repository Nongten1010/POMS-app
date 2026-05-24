#!/usr/bin/env bash
# One-command local API smoke test.
# Starts MSSQL if needed, migrates/seeds DB, starts the dev server if it is not
# already running, then runs the API smoke test suite.
set -euo pipefail

HOST="${API_HOST:-http://localhost:3000}"
STARTED_SERVER=0
SERVER_PID=""

cleanup() {
  if [[ "$STARTED_SERVER" == "1" && -n "$SERVER_PID" ]]; then
    echo "[test] Stopping dev server (pid: $SERVER_PID)"
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

wait_for_health() {
  for _ in {1..30}; do
    if curl -fsS "$HOST/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

echo "[test] Preparing MSSQL..."
./scripts/setup-mssql.sh

echo "[test] Running migrations..."
npm run db:migrate

echo "[test] Running seeds..."
npm run db:seed

if curl -fsS "$HOST/health" >/dev/null 2>&1; then
  echo "[test] Dev server already running at $HOST"
else
  echo "[test] Starting dev server..."
  npm run dev >/tmp/poms-backend-dev.log 2>&1 &
  SERVER_PID="$!"
  STARTED_SERVER=1

  if ! wait_for_health; then
    echo "[test] Dev server did not become ready. Last logs:"
    tail -80 /tmp/poms-backend-dev.log || true
    exit 1
  fi
fi

echo "[test] Running API smoke tests..."
./scripts/test-api.sh
