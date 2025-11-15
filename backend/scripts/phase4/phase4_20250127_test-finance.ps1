# Finance Module Test Script
# This script tests the Finance & Accounting module endpoints

$baseUrl = "http://localhost:3000/api/v1"
$email = "admin@igdgroup.com"  # Adjust based on your test user
$password = "Admin123!"  # Adjust based on your test user

Write-Host "=== Finance Module Testing ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Login (try multiple test users)
Write-Host "1. Logging in..." -ForegroundColor Yellow
$token = $null

foreach ($testUser in $testUsers) {
    $loginBody = @{
        email = $testUser.email
        password = $testUser.password
    } | ConvertTo-Json
    
    try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    # Handle both response formats (with/without data wrapper)
    if ($loginResponse.data) {
        $token = $loginResponse.data.access_token
        $userRoles = $loginResponse.data.user.roles
    } else {
        $token = $loginResponse.accessToken
        $userRoles = $loginResponse.user.roles
    }
    $email = $testUser.email
    $password = $testUser.password
    Write-Host "   [OK] Login successful with $($testUser.email)" -ForegroundColor Green
    Write-Host "   Token: $($token.Substring(0, 20))..." -ForegroundColor Gray
    Write-Host "   Roles: $($userRoles -join ', ')" -ForegroundColor Gray
    break
    } catch {
        Write-Host "   [SKIP] Failed with $($testUser.email): $($_.Exception.Message)" -ForegroundColor Gray
    }
}

if (-not $token) {
    Write-Host "   [INFO] No existing user found, attempting to register..." -ForegroundColor Yellow
    
    # Try to register a test user
    $registerBody = @{
        email = "cfo@igdgroup.com"
        password = "Admin123!"
        fullName = "CFO Test User"
        phone = "081234567890"
    } | ConvertTo-Json
    
    try {
        $registerResponse = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body $registerBody -ContentType "application/json"
        Write-Host "   [OK] User registered successfully" -ForegroundColor Green
        
        # Now try to login
        $loginBody = @{
            email = "cfo@igdgroup.com"
            password = "Admin123!"
        } | ConvertTo-Json
        
        $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
        if ($loginResponse.data) {
            $token = $loginResponse.data.access_token
        } else {
            $token = $loginResponse.accessToken
        }
        $email = "cfo@igdgroup.com"
        Write-Host "   [OK] Login successful after registration" -ForegroundColor Green
    } catch {
        # User might already exist, try to login directly
        Write-Host "   [INFO] Registration failed (user may exist), trying login..." -ForegroundColor Yellow
        $loginBody = @{
            email = "cfo@igdgroup.com"
            password = "Admin123!"
        } | ConvertTo-Json
        
        try {
            $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
            if ($loginResponse.data) {
                $token = $loginResponse.data.access_token
            } else {
                $token = $loginResponse.accessToken
            }
            $email = "cfo@igdgroup.com"
            Write-Host "   [OK] Login successful" -ForegroundColor Green
        } catch {
            Write-Host "   [FAIL] Could not login: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "   Please check user credentials or create user manually" -ForegroundColor Yellow
            exit 1
        }
    }
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Write-Host ""

# Step 2: Seed Chart of Accounts
Write-Host "2. Seeding Chart of Accounts..." -ForegroundColor Yellow
try {
    $seedResponse = Invoke-RestMethod -Uri "$baseUrl/chart-of-accounts/seed" -Method POST -Headers $headers
    Write-Host "   [OK] COA seeded successfully" -ForegroundColor Green
    if ($seedResponse.created) {
        Write-Host "   Created: $($seedResponse.created) accounts" -ForegroundColor Gray
    }
} catch {
    Write-Host "   [FAIL] Seed failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""

# Step 3: Get Chart of Accounts
Write-Host "3. Getting Chart of Accounts..." -ForegroundColor Yellow
try {
    $coaResponse = Invoke-RestMethod -Uri "$baseUrl/chart-of-accounts" -Method GET -Headers $headers
    $coaCount = 0
    if ($coaResponse -is [array]) {
        $coaCount = $coaResponse.Count
    } elseif ($coaResponse -is [PSCustomObject]) {
        $coaCount = 1
    }
    Write-Host "   [OK] Retrieved $coaCount accounts" -ForegroundColor Green
} catch {
    Write-Host "   [FAIL] Get COA failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Step 4: Get account IDs for Journal Entry test
Write-Host "4. Getting account IDs for Journal Entry test..." -ForegroundColor Yellow
$cashAccountId = $null
$revenueAccountId = $null

try {
    $accounts = Invoke-RestMethod -Uri "$baseUrl/chart-of-accounts" -Method GET -Headers $headers
    $accountList = @()
    if ($accounts -is [array]) {
        $accountList = $accounts
    } elseif ($accounts -is [PSCustomObject]) {
        $accountList = @($accounts)
    }
    
    foreach ($acc in $accountList) {
        if ($acc.code -eq "10101") {
            $cashAccountId = $acc.id
        }
        if ($acc.code -eq "40100") {
            $revenueAccountId = $acc.id
        }
    }
    
    if ($cashAccountId -and $revenueAccountId) {
        Write-Host "   [OK] Found Cash and Revenue accounts" -ForegroundColor Green
    } else {
        Write-Host "   [WARN] Could not find required accounts (Cash: $cashAccountId, Revenue: $revenueAccountId)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   [FAIL] Could not get accounts: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Step 5: Create a Journal Entry (if accounts found)
if ($cashAccountId -and $revenueAccountId) {
    Write-Host "5. Creating a test Journal Entry..." -ForegroundColor Yellow
    $journalEntry = @{
        entry_date = (Get-Date).ToString("yyyy-MM-dd")
        entry_type = "manual"
        description = "Test Journal Entry - Initial Setup"
        lines = @(
            @{
                account_id = $cashAccountId
                debit_amount = 1000000
                credit_amount = 0
                line_description = "Test Debit"
            },
            @{
                account_id = $revenueAccountId
                debit_amount = 0
                credit_amount = 1000000
                line_description = "Test Credit"
            }
        )
    }
    
    $journalBody = $journalEntry | ConvertTo-Json -Depth 10
    try {
        $jeResponse = Invoke-RestMethod -Uri "$baseUrl/journal-entries" -Method POST -Body $journalBody -Headers $headers
        Write-Host "   [OK] Journal Entry created: $($jeResponse.entryNumber)" -ForegroundColor Green
    } catch {
        Write-Host "   [FAIL] Create Journal Entry failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "5. Skipping Journal Entry creation (accounts not found)" -ForegroundColor Yellow
}

Write-Host ""

# Step 6: Get Journal Entries
Write-Host "6. Getting Journal Entries..." -ForegroundColor Yellow
try {
    $jeListResponse = Invoke-RestMethod -Uri "$baseUrl/journal-entries" -Method GET -Headers $headers
    $jeCount = 0
    if ($jeListResponse -is [array]) {
        $jeCount = $jeListResponse.Count
    } elseif ($jeListResponse -is [PSCustomObject]) {
        $jeCount = 1
    }
    Write-Host "   [OK] Retrieved $jeCount journal entries" -ForegroundColor Green
} catch {
    Write-Host "   [FAIL] Get Journal Entries failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Step 7: Test Financial Reports
Write-Host "7. Testing Financial Reports..." -ForegroundColor Yellow

$startDate = (Get-Date).AddMonths(-1).ToString("yyyy-MM-dd")
$endDate = (Get-Date).ToString("yyyy-MM-dd")
$asOfDate = (Get-Date).ToString("yyyy-MM-dd")

# Trial Balance
Write-Host "   - Trial Balance..." -ForegroundColor Gray
try {
    $tbUrl = "$baseUrl/financial-reports/trial-balance?startDate=$startDate&endDate=$endDate"
    $tbResponse = Invoke-RestMethod -Uri $tbUrl -Method GET -Headers $headers
    Write-Host "     [OK] Trial Balance retrieved" -ForegroundColor Green
} catch {
    Write-Host "     [FAIL] Trial Balance failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Profit and Loss
Write-Host "   - Profit and Loss..." -ForegroundColor Gray
try {
    $plUrl = "$baseUrl/financial-reports/profit-loss?startDate=$startDate&endDate=$endDate"
    $plResponse = Invoke-RestMethod -Uri $plUrl -Method GET -Headers $headers
    Write-Host "     [OK] Profit and Loss retrieved" -ForegroundColor Green
} catch {
    Write-Host "     [FAIL] Profit and Loss failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Balance Sheet
Write-Host "   - Balance Sheet..." -ForegroundColor Gray
try {
    $bsUrl = "$baseUrl/financial-reports/balance-sheet?asOfDate=$asOfDate"
    $bsResponse = Invoke-RestMethod -Uri $bsUrl -Method GET -Headers $headers
    Write-Host "     [OK] Balance Sheet retrieved" -ForegroundColor Green
} catch {
    Write-Host "     [FAIL] Balance Sheet failed: $($_.Exception.Message)" -ForegroundColor Red
}

# AR Aging Report
Write-Host "   - AR Aging Report..." -ForegroundColor Gray
try {
    $arUrl = "$baseUrl/accounts-receivable/aging-report?asOfDate=$asOfDate"
    $arResponse = Invoke-RestMethod -Uri $arUrl -Method GET -Headers $headers
    Write-Host "     [OK] AR Aging Report retrieved" -ForegroundColor Green
} catch {
    # Try alternative endpoint path
    try {
        $arUrl2 = "$baseUrl/accounts-receivable?asOfDate=$asOfDate"
        $arResponse = Invoke-RestMethod -Uri $arUrl2 -Method GET -Headers $headers
        Write-Host "     [OK] AR Aging Report retrieved (alt path)" -ForegroundColor Green
    } catch {
        Write-Host "     [FAIL] AR Aging Report failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Expense Summary
Write-Host "   - Expense Summary..." -ForegroundColor Gray
try {
    $expUrl = "$baseUrl/financial-reports/expense-summary?startDate=$startDate&endDate=$endDate"
    $expResponse = Invoke-RestMethod -Uri $expUrl -Method GET -Headers $headers
    Write-Host "     [OK] Expense Summary retrieved" -ForegroundColor Green
} catch {
    Write-Host "     [FAIL] Expense Summary failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Testing Complete ===" -ForegroundColor Cyan
