#!/usr/bin/env bash
# Setup MSSQL container for local dev (macOS / Linux)
# Usage: ./scripts/setup-mssql.sh
set -euo pipefail

CONTAINER_NAME="poms-mssql"
SA_PASSWORD="${SA_PASSWORD:?Set SA_PASSWORD before running this script}"
PORT="${MSSQL_PORT:-1433}"

# Detect arch — Apple Silicon ต้อง --platform linux/amd64 (Rosetta)
PLATFORM_FLAG=""
if [[ "$(uname -m)" == "arm64" ]]; then
  PLATFORM_FLAG="--platform linux/amd64"
  echo "[setup] Apple Silicon detected — running under Rosetta"
fi

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "[setup] Container '${CONTAINER_NAME}' already exists. Starting it..."
  docker start "${CONTAINER_NAME}" > /dev/null
else
  echo "[setup] Creating new MSSQL 2022 container..."
  docker run ${PLATFORM_FLAG} \
    -e "ACCEPT_EULA=Y" \
    -e "MSSQL_SA_PASSWORD=${SA_PASSWORD}" \
    -p "${PORT}:1433" \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    -d mcr.microsoft.com/mssql/server:2022-latest
fi

echo "[setup] Waiting for MSSQL to be ready..."
for i in {1..60}; do
  if docker exec "${CONTAINER_NAME}" /opt/mssql-tools18/bin/sqlcmd \
       -S localhost -U sa -P "${SA_PASSWORD}" -C -Q "SELECT 1" > /dev/null 2>&1; then
    echo "[setup] MSSQL ready"
    break
  fi
  sleep 2
done

echo "[setup] Creating database POMS (if not exists)..."
docker exec "${CONTAINER_NAME}" /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "${SA_PASSWORD}" -C \
  -Q "IF DB_ID('POMS') IS NULL CREATE DATABASE POMS;"

echo "[setup] Done."
echo ""
echo "Next steps:"
echo "  1. Ensure .env has: DB_PASSWORD=${SA_PASSWORD}"
echo "  2. Run: npm run db:migrate"
echo "  3. Run: npm run db:seed"
echo "  4. Run: npm run dev"
