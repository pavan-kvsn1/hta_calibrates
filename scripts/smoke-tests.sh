#!/bin/bash
#
# Smoke Tests for HTA Calibration
# Usage: ./scripts/smoke-tests.sh [BASE_URL] [MODE]
#
# MODE:
#   auto    - Auto-detect based on whether data exists (default)
#   strict  - Require seeded data (for dev)
#   lenient - Only infrastructure checks (for prod first deploy)
#
# Examples:
#   ./scripts/smoke-tests.sh                                    # Test localhost:3000 (auto)
#   ./scripts/smoke-tests.sh https://dev.hta-calibration.com    # Dev (auto -> strict)
#   ./scripts/smoke-tests.sh https://hta-calibration.com        # Prod (auto -> detects)
#   ./scripts/smoke-tests.sh https://hta-calibration.com strict # Force strict
#

set -e

BASE_URL="${1:-http://localhost:3000}"
INPUT_MODE="${2:-auto}"
TIMEOUT=30
PASSED=0
FAILED=0
SKIPPED=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "=========================================="
echo " HTA Calibration - Smoke Tests"
echo "=========================================="
echo " Target: ${BASE_URL}"

# Auto-detect mode if needed
if [ "$INPUT_MODE" == "auto" ]; then
  echo -e " Mode:   auto-detecting..."

  # Quick check if the service is up first
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${BASE_URL}/api/health" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" != "200" ]; then
    echo -e " ${RED}Service not reachable (HTTP ${HTTP_CODE})${NC}"
    echo "=========================================="
    exit 1
  fi

  # Run lenient check to see what data exists
  DETECT_RESPONSE=$(curl -s --max-time 30 "${BASE_URL}/api/smoke-test?mode=lenient" 2>/dev/null || echo "{}")
  HAS_DATA=false

  # Check admin exists
  ADMIN_MSG=$(echo "$DETECT_RESPONSE" | jq -r '.checks.admin_exists.message // ""' 2>/dev/null || echo "")
  if echo "$ADMIN_MSG" | grep -q "Admin found"; then
    echo -e "         ${GREEN}✓${NC} Admin user found"
    HAS_DATA=true
  fi

  # Check users count > 1
  USERS_MSG=$(echo "$DETECT_RESPONSE" | jq -r '.checks.users_exist.message // ""' 2>/dev/null || echo "")
  USERS_COUNT=$(echo "$USERS_MSG" | grep -oE 'Found [0-9]+' | grep -oE '[0-9]+' || echo "0")
  if [ "$USERS_COUNT" -gt 1 ]; then
    echo -e "         ${GREEN}✓${NC} Found $USERS_COUNT users"
    HAS_DATA=true
  fi

  # Check customer accounts count > 1
  CUSTOMERS_MSG=$(echo "$DETECT_RESPONSE" | jq -r '.checks.customer_accounts_exist.message // ""' 2>/dev/null || echo "")
  CUSTOMERS_COUNT=$(echo "$CUSTOMERS_MSG" | grep -oE 'Found [0-9]+' | grep -oE '[0-9]+' || echo "0")
  if [ "$CUSTOMERS_COUNT" -gt 1 ]; then
    echo -e "         ${GREEN}✓${NC} Found $CUSTOMERS_COUNT customer accounts"
    HAS_DATA=true
  fi

  # Check customer users count > 1
  CUSTUSERS_MSG=$(echo "$DETECT_RESPONSE" | jq -r '.checks.customer_users_exist.message // ""' 2>/dev/null || echo "")
  CUSTUSERS_COUNT=$(echo "$CUSTUSERS_MSG" | grep -oE 'Found [0-9]+' | grep -oE '[0-9]+' || echo "0")
  if [ "$CUSTUSERS_COUNT" -gt 1 ]; then
    echo -e "         ${GREEN}✓${NC} Found $CUSTUSERS_COUNT customer users"
    HAS_DATA=true
  fi

  if [ "$HAS_DATA" = true ]; then
    MODE="strict"
    echo -e " Mode:   ${GREEN}strict${NC} (data detected)"
  else
    MODE="lenient"
    echo -e " Mode:   ${YELLOW}lenient${NC} (no significant data)"
  fi
else
  MODE="$INPUT_MODE"
  echo " Mode:   ${MODE}"
fi

echo " Timeout: ${TIMEOUT}s per request"
echo "=========================================="
echo ""

# Function to test an endpoint
test_endpoint() {
  local name="$1"
  local path="$2"
  local expected_code="${3:-200}"

  echo -n "  [TEST] ${name}... "

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time ${TIMEOUT} "${BASE_URL}${path}" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" -eq "$expected_code" ]; then
    echo -e "${GREEN}PASS${NC} (HTTP ${HTTP_CODE})"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}FAIL${NC} (HTTP ${HTTP_CODE}, expected ${expected_code})"
    ((FAILED++))
    return 1
  fi
}

# Function to test endpoint returns valid JSON
test_json_endpoint() {
  local name="$1"
  local path="$2"

  echo -n "  [TEST] ${name}... "

  RESPONSE=$(curl -s --max-time ${TIMEOUT} "${BASE_URL}${path}" 2>/dev/null || echo "")

  if echo "$RESPONSE" | jq . >/dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC} (valid JSON)"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}FAIL${NC} (invalid JSON)"
    ((FAILED++))
    return 1
  fi
}

# Function to test JSON field exists
test_json_field() {
  local name="$1"
  local path="$2"
  local field="$3"

  echo -n "  [TEST] ${name}... "

  RESPONSE=$(curl -s --max-time ${TIMEOUT} "${BASE_URL}${path}" 2>/dev/null || echo "{}")

  if echo "$RESPONSE" | jq -e "${field}" >/dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}FAIL${NC} (field '${field}' not found)"
    ((FAILED++))
    return 1
  fi
}

# Function to test static asset
test_static_asset() {
  local name="$1"
  local path="$2"
  local content_type="$3"

  echo -n "  [TEST] ${name}... "

  HEADERS=$(curl -s -I --max-time ${TIMEOUT} "${BASE_URL}${path}" 2>/dev/null || echo "")
  HTTP_CODE=$(echo "$HEADERS" | grep -i "HTTP/" | tail -1 | awk '{print $2}')
  ACTUAL_TYPE=$(echo "$HEADERS" | grep -i "content-type:" | awk '{print $2}' | tr -d '\r')

  if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}PASS${NC} (HTTP 200)"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}FAIL${NC} (HTTP ${HTTP_CODE:-000})"
    ((FAILED++))
    return 1
  fi
}

# ==========================================
# 1. HEALTH CHECKS
# ==========================================
echo -e "${BLUE}[1/6] Health Checks${NC}"
test_endpoint "Liveness probe" "/api/health"
test_json_field "Health response structure" "/api/health" ".status"
test_json_field "Health has timestamp" "/api/health" ".timestamp"
test_endpoint "Readiness probe" "/api/health/ready"
test_json_field "Ready has database check" "/api/health/ready" ".checks.database"
test_json_field "Ready has cache check" "/api/health/ready" ".checks.cache"
echo ""

# ==========================================
# 2. COMPREHENSIVE SMOKE TEST (DB + SEED DATA)
# ==========================================
echo -e "${BLUE}[2/6] Database & Seed Data Verification (mode: ${MODE})${NC}"
SMOKE_URL="/api/smoke-test?mode=${MODE}"
test_endpoint "Smoke test endpoint" "${SMOKE_URL}"
test_json_field "Smoke test passed" "${SMOKE_URL}" '.status == "pass" or .status == "partial"'
test_json_field "Schema valid" "${SMOKE_URL}" '.checks.schema_valid.status == "pass"'
test_json_field "Users check" "${SMOKE_URL}" '.checks.users_exist.status == "pass"'
test_json_field "Admin check" "${SMOKE_URL}" '.checks.admin_exists.status == "pass"'

if [ "$MODE" == "strict" ]; then
  test_json_field "Engineers exist" "${SMOKE_URL}" '.checks.engineers_exist.status == "pass"'
  test_json_field "Customer accounts exist" "${SMOKE_URL}" '.checks.customer_accounts_exist.status == "pass"'
  test_json_field "Master instruments exist" "${SMOKE_URL}" '.checks.master_instruments_exist.status == "pass"'
  test_json_field "Test customer exists" "${SMOKE_URL}" '.checks.test_customer_exists.status == "pass"'
else
  echo -e "  ${YELLOW}[SKIP]${NC} Seed data checks skipped in lenient mode"
  ((SKIPPED+=4))
fi
echo ""

# ==========================================
# 3. AUTHENTICATION ENDPOINTS
# ==========================================
echo -e "${BLUE}[3/6] Authentication Endpoints${NC}"
test_endpoint "Auth providers API" "/api/auth/providers"
test_json_endpoint "Auth providers JSON valid" "/api/auth/providers"
test_endpoint "Staff login page" "/login"
test_endpoint "Customer login page" "/customer/login"
test_endpoint "Forgot password page" "/forgot-password"
test_endpoint "Customer forgot password" "/customer/forgot-password"
echo ""

# ==========================================
# 4. PROTECTED ROUTES (REDIRECT CHECK)
# ==========================================
echo -e "${BLUE}[4/6] Protected Routes (Expect Redirects)${NC}"
test_endpoint "Dashboard redirect" "/dashboard" "307"
test_endpoint "Admin redirect" "/admin" "307"
test_endpoint "Certificates redirect" "/certificates" "307"
test_endpoint "Customer portal redirect" "/customer" "307"
echo ""

# ==========================================
# 5. API STRUCTURE VALIDATION
# ==========================================
echo -e "${BLUE}[5/6] API Response Structure${NC}"
test_json_field "Health has environment" "/api/health" ".environment"
test_json_field "Health has version" "/api/health" ".version"
test_json_field "Auth has staff-credentials" "/api/auth/providers" '.["staff-credentials"]'
test_json_field "Auth has customer-credentials" "/api/auth/providers" '.["customer-credentials"]'
echo ""

# ==========================================
# 6. STATIC ASSETS
# ==========================================
echo -e "${BLUE}[6/6] Static Assets${NC}"
# Test Next.js static chunks (exact path varies by build, test root redirect)
test_endpoint "Favicon" "/favicon.ico"
# Note: _next/static paths are build-specific, so we test via root page
MAIN_PAGE=$(curl -s --max-time ${TIMEOUT} "${BASE_URL}/login" 2>/dev/null || echo "")
if echo "$MAIN_PAGE" | grep -q "_next/static"; then
  echo -e "  [TEST] Next.js static assets referenced... ${GREEN}PASS${NC}"
  ((PASSED++))
else
  echo -e "  [TEST] Next.js static assets referenced... ${YELLOW}SKIP${NC} (page may not have JS)"
  ((SKIPPED++))
fi
echo ""

# ==========================================
# RESULTS
# ==========================================
echo "=========================================="
echo " Results"
echo "=========================================="
echo -e " ${GREEN}Passed:${NC}  ${PASSED}"
echo -e " ${RED}Failed:${NC}  ${FAILED}"
echo -e " ${YELLOW}Skipped:${NC} ${SKIPPED}"
echo "=========================================="

if [ "$FAILED" -gt 0 ]; then
  echo -e "${RED}SMOKE TESTS FAILED${NC}"
  echo ""
  echo "To debug, run:"
  echo "  curl -s ${BASE_URL}/api/smoke-test | jq ."
  exit 1
else
  echo -e "${GREEN}ALL SMOKE TESTS PASSED${NC}"
  exit 0
fi
