#!/usr/bin/env bash
# Manual API smoke test — ไม่ต้องใช้ extension อะไร
# Usage: ./scripts/test-api.sh
set -uo pipefail

HOST="${API_HOST:-http://localhost:3000}"
PREFIX="/api/v1"

# ANSI colors
GREEN=$'\033[0;32m'
RED=$'\033[0;31m'
YELLOW=$'\033[0;33m'
CYAN=$'\033[0;36m'
BOLD=$'\033[1m'
RESET=$'\033[0m'

PASS=0
FAIL=0

print_section() {
  echo ""
  echo "${CYAN}${BOLD}━━━ $1 ━━━${RESET}"
}

# Run test:  expect_status <name> <expected_code> <curl_args...>
expect_status() {
  local name="$1"
  local expected="$2"
  shift 2
  local response
  local code
  response=$(curl -s -w "\n__HTTP_CODE__%{http_code}" "$@")
  code=$(echo "$response" | grep -o '__HTTP_CODE__[0-9]*' | sed 's/__HTTP_CODE__//')
  local body
  body=$(echo "$response" | sed 's/__HTTP_CODE__[0-9]*$//')

  if [[ "$code" == "$expected" ]]; then
    echo "${GREEN}✓${RESET} $name ${GREEN}[$code]${RESET}"
    PASS=$((PASS + 1))
  else
    echo "${RED}✗${RESET} $name ${RED}[expected $expected, got $code]${RESET}"
    echo "    Body: $body" | head -c 200
    echo ""
    FAIL=$((FAIL + 1))
  fi
}

# Extract field from JSON response
get_json() {
  echo "$1" | python3 -c "import sys,json;d=json.load(sys.stdin);
$2" 2>/dev/null
}

# ============================================================================
echo "${BOLD}POMS Backend — API Smoke Test${RESET}"
echo "Target: $HOST$PREFIX"

if ! curl -fsS "$HOST/health" >/dev/null 2>&1; then
  echo ""
  echo "${RED}${BOLD}✗ Backend is not running at $HOST${RESET}"
  echo ""
  echo "Start the server first:"
  echo "  npm run dev"
  echo ""
  echo "Or run the one-command local test setup:"
  echo "  npm run test:api:local"
  exit 1
fi

# 1. Health check
print_section "1. Health check"
expect_status "GET /health"  200  "$HOST/health"

# 2. Login flows
print_section "2. Login — 5 user types"
expect_status "POST /auth/login (admin officer 'weekit')"     200 -X POST "$HOST$PREFIX/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"userType":"officer","username":"weekit","departmentID":"2","password":"demo1234"}'

expect_status "POST /auth/login (kpm officer)"               200 -X POST "$HOST$PREFIX/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"userType":"officer","username":"officer_kpm","departmentID":"2","password":"demo1234"}'

expect_status "POST /auth/login (provincial officer)"        200 -X POST "$HOST$PREFIX/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"userType":"officer","username":"officer_sng","departmentID":"2","password":"demo1234"}'

expect_status "POST /auth/login (operator 'ธนาภรณ์')"        200 -X POST "$HOST$PREFIX/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"userType":"operator","username":"operator_demo","password":"demo1234"}'

expect_status "POST /auth/login (citizen)"                   200 -X POST "$HOST$PREFIX/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"userType":"citizen","username":"citizen_demo","password":"demo1234"}'

# 3. /me with token
print_section "3. /me with valid token"
LOGIN_RESP=$(curl -s -X POST "$HOST$PREFIX/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"userType":"officer","username":"weekit","departmentID":"2","password":"demo1234"}')
TOKEN=$(get_json "$LOGIN_RESP" "print(d['accessToken'])")

if [[ -n "$TOKEN" ]]; then
  expect_status "GET /auth/me (with admin token)" 200 "$HOST$PREFIX/auth/me" \
    -H "Authorization: Bearer $TOKEN"
else
  echo "${RED}✗ ไม่ได้ token จาก login${RESET}"
  FAIL=$((FAIL + 1))
fi

# 4. Error cases
print_section "4. Error cases"
expect_status "Wrong password → 401"            401 -X POST "$HOST$PREFIX/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"userType":"officer","username":"weekit","departmentID":"2","password":"WRONG"}'

expect_status "Missing password → 400"          400 -X POST "$HOST$PREFIX/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"userType":"officer","username":"weekit","departmentID":"2"}'

expect_status "Operator without username → 400" 400 -X POST "$HOST$PREFIX/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"userType":"operator","password":"demo1234"}'

expect_status "Invalid userType → 400"          400 -X POST "$HOST$PREFIX/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"userType":"robot","username":"x","password":"y"}'

expect_status "No Authorization header → 401"    401 "$HOST$PREFIX/auth/me"
expect_status "Invalid Bearer token → 401"       401 "$HOST$PREFIX/auth/me" \
  -H "Authorization: Bearer fake.token.value"

expect_status "Unknown route → 404"              404 "$HOST$PREFIX/does-not-exist"
expect_status "Ghost user → 401"                 401 -X POST "$HOST$PREFIX/auth/login" \
  -H 'Content-Type: application/json' \
  -H 'X-Forwarded-For: 127.0.0.2' \
  -d '{"userType":"officer","username":"ghost_user","departmentID":"2","password":"demo1234"}'

# 5. Inspection — แสดงข้อมูลที่สำคัญจาก login response
print_section "5. Verify response shape (admin login)"
if [[ -n "$TOKEN" ]]; then
  USERNAME=$(get_json "$LOGIN_RESP" "print(d['user']['username'])")
  FULL_NAME=$(get_json "$LOGIN_RESP" "print(d['user']['fullName'])")
  ROLE_CODE=$(get_json "$LOGIN_RESP" "print(d['user']['roles'])")
  DASHBOARD_DATA=$(get_json "$LOGIN_RESP" "print(d['permissions']['dashboard']['data'])")
  DASHBOARD_SEARCH=$(get_json "$LOGIN_RESP" "print(d['permissions']['dashboard']['advanced_search'])")
  PERM_COUNT=$(get_json "$LOGIN_RESP" "print(len(d['permissions']))")

  echo "  user.username   = $USERNAME"
  echo "  user.fullName   = $FULL_NAME"
  echo "  user.roles      = $ROLE_CODE"
  echo "  permissions     = $PERM_COUNT รายการ"
  echo "  dashboard.data  = $DASHBOARD_DATA"
  echo "  dashboard.advanced_search = $DASHBOARD_SEARCH"
fi

# 6. Operator permission scope check
print_section "6. Operator login — ดู permission data scope"
OP_RESP=$(curl -s -X POST "$HOST$PREFIX/auth/login" \
  -H 'Content-Type: application/json' \
  -H 'X-Forwarded-For: 127.0.0.3' \
  -d '{"userType":"operator","username":"operator_demo","password":"demo1234"}')
OP_USERNAME=$(get_json "$OP_RESP" "print(d['user']['username'])")
OP_SCOPE=$(get_json "$OP_RESP" "print(d['permissions']['factories']['data'])")
echo "  user.username = $OP_USERNAME"
echo "  permissions.factories.data = $OP_SCOPE (expect OWN_FACTORY)"

# Summary
echo ""
echo "${BOLD}═══════════════════════════════════════════════${RESET}"
if [[ $FAIL -eq 0 ]]; then
  echo "${GREEN}${BOLD}✓ All $PASS tests passed${RESET}"
  exit 0
else
  echo "${RED}${BOLD}✗ $FAIL failed, $PASS passed${RESET}"
  exit 1
fi
