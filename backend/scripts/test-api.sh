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
  -d '{"userType":"officer","username":"weekit","password":"demo1234"}'

expect_status "POST /auth/login (kpm officer)"               200 -X POST "$HOST$PREFIX/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"userType":"officer","username":"officer_kpm","password":"demo1234"}'

expect_status "POST /auth/login (provincial officer)"        200 -X POST "$HOST$PREFIX/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"userType":"officer","username":"officer_sng","password":"demo1234"}'

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
  -d '{"userType":"officer","username":"weekit","password":"demo1234"}')
TOKEN=$(get_json "$LOGIN_RESP" "print(d['data']['accessToken'])")

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
  -d '{"userType":"officer","username":"weekit","password":"WRONG"}'

expect_status "Missing password → 400"          400 -X POST "$HOST$PREFIX/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"userType":"officer","username":"weekit"}'

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
  -d '{"userType":"officer","username":"ghost_user","password":"demo1234"}'

# 5. Inspection — แสดงข้อมูลที่สำคัญจาก login response
print_section "5. Verify response shape (admin login)"
if [[ -n "$TOKEN" ]]; then
  USER_ID=$(get_json "$LOGIN_RESP" "print(d['data']['user']['id'])")
  USER_TYPE_VAL=$(get_json "$LOGIN_RESP" "print(d['data']['user']['userType'])")
  FIRST_NAME=$(get_json "$LOGIN_RESP" "print(d['data']['user']['firstName'])")
  LAST_NAME=$(get_json "$LOGIN_RESP" "print(d['data']['user']['lastName'])")
  PERM_COUNT=$(get_json "$LOGIN_RESP" "print(len(d['data']['permissions']))")
  FACTORIES_SCOPE=$(get_json "$LOGIN_RESP" "print(d['data']['scopes'].get('factories:view','-'))")

  echo "  user.id         = $USER_ID (type: $(get_json "$LOGIN_RESP" "print(type(d['data']['user']['id']).__name__)"))"
  echo "  user.userType   = $USER_TYPE_VAL"
  echo "  user.firstName  = $FIRST_NAME"
  echo "  user.lastName   = $LAST_NAME"
  echo "  permissions     = $PERM_COUNT รายการ"
  echo "  scopes['factories:view'] = $FACTORIES_SCOPE"
fi

# 6. Operator factories check
print_section "6. Operator login — ดูจำนวน factories"
OP_RESP=$(curl -s -X POST "$HOST$PREFIX/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"userType":"operator","username":"operator_demo","password":"demo1234"}')
NUM_J=$(get_json "$OP_RESP" "print(len(d['data']['profile']['juristics']))")
NUM_F=$(get_json "$OP_RESP" "print(sum(len(j['factories']) for j in d['data']['profile']['juristics']))")
OP_SCOPE=$(get_json "$OP_RESP" "print(d['data']['scopes'].get('factories:view','-'))")
echo "  juristics count = $NUM_J (expect 2)"
echo "  factories total = $NUM_F (expect 7)"
echo "  scopes['factories:view'] = $OP_SCOPE (expect OWN_FACTORY)"

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
