#!/bin/bash

# ZaraBooks E2E Test Runner
# Usage: ./run-tests.sh [test-suite]

BASE_URL="https://scintillating-stillness-production-02d4.up.railway.app"
COOKIE_FILE="/tmp/zarabooks-test-cookies.txt"
RESULTS_FILE="/tmp/zarabooks-test-results.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Initialize results
echo '{"tests":[],"summary":{"passed":0,"failed":0,"skipped":0}}' > $RESULTS_FILE

# Helper function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expect_auth=${4:-true}

    local url="${BASE_URL}${endpoint}"
    local curl_opts="-s -w '\n%{http_code}'"

    if [ "$expect_auth" = true ]; then
        curl_opts="$curl_opts -b $COOKIE_FILE"
    fi

    if [ "$method" = "GET" ]; then
        response=$(curl $curl_opts "$url")
    else
        response=$(curl $curl_opts -X $method -H "Content-Type: application/json" -d "$data" "$url")
    fi

    echo "$response"
}

# Login and get session
login() {
    echo -e "${YELLOW}Logging in...${NC}"
    response=$(curl -s -c $COOKIE_FILE -X POST \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@example.com","password":"Admin@123"}' \
        "${BASE_URL}/api/auth/login")

    if echo "$response" | grep -q '"user"'; then
        echo -e "${GREEN}Login successful${NC}"
        return 0
    else
        echo -e "${RED}Login failed: $response${NC}"
        return 1
    fi
}

# Test function
run_test() {
    local test_id=$1
    local test_name=$2
    local method=$3
    local endpoint=$4
    local data=$5
    local expected_status=$6

    echo -n "Testing [$test_id] $test_name... "

    local url="${BASE_URL}${endpoint}"

    if [ "$method" = "GET" ]; then
        response=$(curl -s -b $COOKIE_FILE -w "\n%{http_code}" "$url")
    else
        response=$(curl -s -b $COOKIE_FILE -w "\n%{http_code}" -X $method \
            -H "Content-Type: application/json" \
            -d "$data" "$url")
    fi

    # Extract status code (last line)
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}PASS${NC} (HTTP $status_code)"
        return 0
    else
        echo -e "${RED}FAIL${NC} (Expected $expected_status, got $status_code)"
        echo "Response: $body" | head -c 200
        echo ""
        return 1
    fi
}

# Main test execution
main() {
    echo "========================================"
    echo "ZaraBooks E2E Test Suite"
    echo "========================================"
    echo ""

    # Login first
    if ! login; then
        echo "Cannot proceed without authentication"
        exit 1
    fi

    echo ""
    echo "========================================"
    echo "AUTHENTICATION TESTS"
    echo "========================================"
    run_test "AUTH-001" "Get current user" "GET" "/api/auth/me" "" "200"

    echo ""
    echo "========================================"
    echo "PARTY TESTS (Customer/Vendor)"
    echo "========================================"

    # Create customer
    CUSTOMER_DATA='{"partyType":"customer","name":"Test Customer '$(date +%s)'","email":"test'$(date +%s)'@test.com"}'
    run_test "PARTY-001" "Create customer" "POST" "/api/parties" "$CUSTOMER_DATA" "201"

    # Get customer ID from response for later tests
    CUSTOMER_ID=$(curl -s -b $COOKIE_FILE "${BASE_URL}/api/parties?type=customer" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

    run_test "PARTY-002" "List customers" "GET" "/api/parties?type=customer" "" "200"

    # Create vendor
    VENDOR_DATA='{"partyType":"vendor","name":"Test Vendor '$(date +%s)'","email":"vendor'$(date +%s)'@test.com"}'
    run_test "PARTY-003" "Create vendor" "POST" "/api/parties" "$VENDOR_DATA" "201"

    VENDOR_ID=$(curl -s -b $COOKIE_FILE "${BASE_URL}/api/parties?type=vendor" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

    run_test "PARTY-004" "List vendors" "GET" "/api/parties?type=vendor" "" "200"

    echo ""
    echo "========================================"
    echo "PRODUCT TESTS"
    echo "========================================"
    PRODUCT_DATA='{"name":"Test Product '$(date +%s)'","type":"goods","salesPrice":100,"gstRate":18}'
    run_test "PROD-001" "Create product" "POST" "/api/products" "$PRODUCT_DATA" "201"
    run_test "PROD-002" "List products" "GET" "/api/products" "" "200"

    echo ""
    echo "========================================"
    echo "QUOTE TESTS"
    echo "========================================"
    if [ -n "$CUSTOMER_ID" ]; then
        QUOTE_DATA='{"customerId":"'$CUSTOMER_ID'","quoteDate":"'$(date +%Y-%m-%d)'","validUntil":"'$(date -v+15d +%Y-%m-%d 2>/dev/null || date -d "+15 days" +%Y-%m-%d)'","lines":[{"description":"Test Service","quantity":1,"unitPrice":1000,"taxRate":18}]}'
        run_test "QUOTE-001" "Create quote" "POST" "/api/quotes" "$QUOTE_DATA" "201"
    else
        echo "Skipping quote tests - no customer ID"
    fi
    run_test "QUOTE-002" "List quotes" "GET" "/api/quotes" "" "200"

    echo ""
    echo "========================================"
    echo "INVOICE TESTS"
    echo "========================================"
    if [ -n "$CUSTOMER_ID" ]; then
        INVOICE_DATA='{"customerId":"'$CUSTOMER_ID'","invoiceDate":"'$(date +%Y-%m-%d)'","dueDate":"'$(date -v+30d +%Y-%m-%d 2>/dev/null || date -d "+30 days" +%Y-%m-%d)'","lines":[{"description":"Test Service","quantity":1,"unitPrice":1000,"taxRate":18}]}'
        run_test "INV-001" "Create invoice" "POST" "/api/invoices" "$INVOICE_DATA" "201"
    else
        echo "Skipping invoice tests - no customer ID"
    fi
    run_test "INV-002" "List invoices" "GET" "/api/invoices" "" "200"

    echo ""
    echo "========================================"
    echo "BILL TESTS"
    echo "========================================"
    if [ -n "$VENDOR_ID" ]; then
        BILL_DATA='{"vendorId":"'$VENDOR_ID'","billDate":"'$(date +%Y-%m-%d)'","dueDate":"'$(date -v+30d +%Y-%m-%d 2>/dev/null || date -d "+30 days" +%Y-%m-%d)'","vendorBillNumber":"VB-'$(date +%s)'","lines":[{"description":"Office Supplies","quantity":1,"unitPrice":500,"taxRate":18}]}'
        run_test "BILL-001" "Create bill" "POST" "/api/bills" "$BILL_DATA" "201"
    else
        echo "Skipping bill tests - no vendor ID"
    fi
    run_test "BILL-002" "List bills" "GET" "/api/bills" "" "200"

    echo ""
    echo "========================================"
    echo "BANK ACCOUNT TESTS"
    echo "========================================"
    BANK_DATA='{"bankName":"Test Bank","accountNumber":"'$(date +%s | tail -c 11)'","accountType":"current","ifscCode":"TEST0001234"}'
    run_test "BANK-001" "Create bank account" "POST" "/api/bank-accounts" "$BANK_DATA" "201"
    run_test "BANK-002" "List bank accounts" "GET" "/api/bank-accounts" "" "200"

    echo ""
    echo "========================================"
    echo "CHART OF ACCOUNTS TESTS"
    echo "========================================"
    run_test "COA-001" "List chart of accounts" "GET" "/api/chart-of-accounts" "" "200"
    run_test "COA-002" "Get ledger list" "GET" "/api/chart-of-accounts/ledgers/list" "" "200"

    echo ""
    echo "========================================"
    echo "JOURNAL ENTRY TESTS"
    echo "========================================"
    run_test "JE-001" "List journal entries" "GET" "/api/journal-entries" "" "200"

    echo ""
    echo "========================================"
    echo "FINANCIAL REPORT TESTS"
    echo "========================================"
    run_test "RPT-001" "Get trial balance" "GET" "/api/trial-balance" "" "200"
    run_test "RPT-002" "Get balance sheet" "GET" "/api/financial-statements/balance-sheet" "" "200"
    run_test "RPT-003" "Get profit & loss" "GET" "/api/financial-statements/profit-loss" "" "200"

    echo ""
    echo "========================================"
    echo "SECURITY TESTS"
    echo "========================================"
    # Test without auth
    rm -f $COOKIE_FILE
    run_test "SEC-001" "Access without auth" "GET" "/api/parties" "" "401"

    echo ""
    echo "========================================"
    echo "TEST COMPLETE"
    echo "========================================"
}

main "$@"
