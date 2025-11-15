# Phase 5: Dashboard API Testing Script
# Tests all dashboard endpoints
# Date: 2025-01-27

$baseUrl = "http://localhost:3000/api/v1"
$email = "cfo@igdgroup.com"
$password = "Test@1234"

Write-Host "=== Phase 5 Dashboard API Testing ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Login
Write-Host "[1/4] Logging in..." -ForegroundColor Yellow
try {
    $loginBody = @{
        email = $email
        password = $password
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    
    if ($loginResponse.data) {
        $token = $loginResponse.data.access_token
    } else {
        $token = $loginResponse.accessToken
    }
    
    if (-not $token) {
        Write-Host "   [ERROR] Login failed - no token received" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "   [OK] Login successful" -ForegroundColor Green
} catch {
    Write-Host "   [ERROR] Login failed: $_" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Step 2: Test Executive Dashboard Endpoints
Write-Host ""
Write-Host "[2/4] Testing Executive Dashboard Endpoints..." -ForegroundColor Yellow

$executiveEndpoints = @(
    @{ Path = "/dashboard/kpis"; Name = "KPIs" },
    @{ Path = "/dashboard/revenue-trend"; Name = "Revenue Trend" },
    @{ Path = "/dashboard/sales-by-category"; Name = "Sales by Category" },
    @{ Path = "/dashboard/top-products"; Name = "Top Products" },
    @{ Path = "/dashboard/branch-performance"; Name = "Branch Performance" },
    @{ Path = "/dashboard/recent-transactions"; Name = "Recent Transactions" },
    @{ Path = "/dashboard/pending-approvals"; Name = "Pending Approvals" }
)

$executivePassed = 0
$executiveFailed = 0

foreach ($endpoint in $executiveEndpoints) {
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl$($endpoint.Path)" -Headers $headers -Method Get
        Write-Host "   [OK] $($endpoint.Name)" -ForegroundColor Green
        $executivePassed++
    } catch {
        Write-Host "   [FAIL] $($endpoint.Name): $_" -ForegroundColor Red
        $executiveFailed++
    }
}

# Step 3: Test Sales Dashboard Endpoints
Write-Host ""
Write-Host "[3/4] Testing Sales Dashboard Endpoints..." -ForegroundColor Yellow

$salesEndpoints = @(
    @{ Path = "/dashboard/sales/kpis"; Name = "Sales KPIs" },
    @{ Path = "/dashboard/sales/hourly"; Name = "Hourly Sales" },
    @{ Path = "/dashboard/sales/daily"; Name = "Daily Sales" },
    @{ Path = "/dashboard/sales/payment-method"; Name = "Sales by Payment Method" },
    @{ Path = "/dashboard/sales/customer-type"; Name = "Sales by Customer Type" },
    @{ Path = "/dashboard/sales/top-customers"; Name = "Top Customers" },
    @{ Path = "/dashboard/sales/cashier"; Name = "Sales by Cashier" }
)

$salesPassed = 0
$salesFailed = 0

foreach ($endpoint in $salesEndpoints) {
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl$($endpoint.Path)" -Headers $headers -Method Get
        Write-Host "   [OK] $($endpoint.Name)" -ForegroundColor Green
        $salesPassed++
    } catch {
        Write-Host "   [FAIL] $($endpoint.Name): $_" -ForegroundColor Red
        $salesFailed++
    }
}

# Step 4: Test Inventory Dashboard Endpoints
Write-Host ""
Write-Host "[4/5] Testing Inventory Dashboard Endpoints..." -ForegroundColor Yellow

$inventoryEndpoints = @(
    @{ Path = "/dashboard/inventory/kpis"; Name = "Inventory KPIs" },
    @{ Path = "/dashboard/inventory/stock-by-branch"; Name = "Stock by Branch" },
    @{ Path = "/dashboard/inventory/movement"; Name = "Stock Movement" },
    @{ Path = "/dashboard/inventory/top-moving"; Name = "Top Moving Products" },
    @{ Path = "/dashboard/inventory/low-stock"; Name = "Low Stock Alerts" },
    @{ Path = "/dashboard/inventory/pending-transfers"; Name = "Pending Transfers" },
    @{ Path = "/dashboard/inventory/slow-moving"; Name = "Slow Moving Items" }
)

$inventoryPassed = 0
$inventoryFailed = 0

foreach ($endpoint in $inventoryEndpoints) {
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl$($endpoint.Path)" -Headers $headers -Method Get
        Write-Host "   [OK] $($endpoint.Name)" -ForegroundColor Green
        $inventoryPassed++
    } catch {
        Write-Host "   [FAIL] $($endpoint.Name): $_" -ForegroundColor Red
        $inventoryFailed++
    }
}

# Step 5: Test Service Dashboard Endpoints
Write-Host ""
Write-Host "[5/5] Testing Service Dashboard Endpoints..." -ForegroundColor Yellow

$serviceEndpoints = @(
    @{ Path = "/dashboard/service/kpis"; Name = "Service KPIs" },
    @{ Path = "/dashboard/service/pipeline"; Name = "Service Pipeline" },
    @{ Path = "/dashboard/service/types"; Name = "Service Types" },
    @{ Path = "/dashboard/service/workload"; Name = "Workload by Technician" },
    @{ Path = "/dashboard/service/performance"; Name = "Performance Metrics" },
    @{ Path = "/dashboard/service/overdue"; Name = "Overdue Services" },
    @{ Path = "/dashboard/service/most-used-parts"; Name = "Most Used Parts" },
    @{ Path = "/dashboard/service/sla-compliance"; Name = "SLA Compliance" }
)

$servicePassed = 0
$serviceFailed = 0

foreach ($endpoint in $serviceEndpoints) {
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl$($endpoint.Path)" -Headers $headers -Method Get
        Write-Host "   [OK] $($endpoint.Name)" -ForegroundColor Green
        $servicePassed++
    } catch {
        Write-Host "   [FAIL] $($endpoint.Name): $_" -ForegroundColor Red
        $serviceFailed++
    }
}

# Summary
Write-Host ""
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Executive Dashboard: $executivePassed passed, $executiveFailed failed" -ForegroundColor $(if ($executiveFailed -eq 0) { "Green" } else { "Yellow" })
Write-Host "Sales Dashboard: $salesPassed passed, $salesFailed failed" -ForegroundColor $(if ($salesFailed -eq 0) { "Green" } else { "Yellow" })
Write-Host "Inventory Dashboard: $inventoryPassed passed, $inventoryFailed failed" -ForegroundColor $(if ($inventoryFailed -eq 0) { "Green" } else { "Yellow" })
Write-Host "Service Dashboard: $servicePassed passed, $serviceFailed failed" -ForegroundColor $(if ($serviceFailed -eq 0) { "Green" } else { "Yellow" })

$totalPassed = $executivePassed + $salesPassed + $inventoryPassed + $servicePassed
$totalFailed = $executiveFailed + $salesFailed + $inventoryFailed + $serviceFailed

Write-Host ""
Write-Host "Total: $totalPassed passed, $totalFailed failed out of 24 endpoints" -ForegroundColor $(if ($totalFailed -eq 0) { "Green" } else { "Yellow" })

if ($totalFailed -eq 0) {
    Write-Host ""
    Write-Host "✅ All dashboard endpoints are working!" -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host "⚠️  Some endpoints failed. Check errors above." -ForegroundColor Yellow
    exit 1
}

