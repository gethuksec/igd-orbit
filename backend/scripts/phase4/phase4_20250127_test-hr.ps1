# HR Module Test Script
# Tests all HR endpoints: Attendance, Leave, Payroll, KPI

$baseUrl = "http://localhost:3000/api/v1"
$testResults = @()

# Colors for output
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-Error { param($msg) Write-Host $msg -ForegroundColor Red }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }

Write-Info "=== HR Module Test Script ==="
Write-Info ""

# Test user credentials
$hrUser = @{
    email = "hr@igdgroup.com"
    password = "Admin123!"
}

$employeeUser = @{
    email = "employee1@igdgroup.com"
    password = "Admin123!"
}

# Login as HR user
Write-Info "1. Logging in as HR user..."
try {
    $loginBody = @{
        email = $hrUser.email
        password = $hrUser.password
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    
    if ($loginResponse.data) {
        $hrToken = $loginResponse.data.access_token
        $hrRoles = $loginResponse.data.user.roles
    } else {
        $hrToken = $loginResponse.accessToken
        $hrRoles = $loginResponse.user.roles
    }
    
    Write-Success "✅ HR Login successful. Roles: $($hrRoles -join ', ')"
} catch {
    Write-Error "❌ HR Login failed: $_"
    exit 1
}

# Login as Employee user
Write-Info "2. Logging in as Employee user..."
try {
    $loginBody = @{
        email = $employeeUser.email
        password = $employeeUser.password
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    
    if ($loginResponse.data) {
        $empToken = $loginResponse.data.access_token
    } else {
        $empToken = $loginResponse.accessToken
    }
    
    Write-Success "✅ Employee Login successful"
} catch {
    Write-Error "❌ Employee Login failed: $_"
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $hrToken"
    "Content-Type" = "application/json"
}

$empHeaders = @{
    "Authorization" = "Bearer $empToken"
    "Content-Type" = "application/json"
}

# ============================================
# ATTENDANCE TESTS
# ============================================
Write-Info ""
Write-Info "=== ATTENDANCE TESTS ==="

# Clock In
Write-Info "3. Testing Clock In..."
try {
    $clockInBody = @{
        method = "fingerprint"
        branch_id = (Invoke-RestMethod -Uri "$baseUrl/branches" -Method GET -Headers $empHeaders | Select-Object -First 1 -ExpandProperty id)
        location = "Branch Office"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/attendance/clock-in" -Method POST -Body $clockInBody -Headers $empHeaders
    Write-Success "✅ Clock In successful"
    $testResults += @{ Test = "Clock In"; Status = "PASS" }
} catch {
    Write-Error "❌ Clock In failed: $_"
    $testResults += @{ Test = "Clock In"; Status = "FAIL"; Error = $_.Exception.Message }
}

# Clock Out
Write-Info "4. Testing Clock Out..."
try {
    $clockOutBody = @{
        method = "fingerprint"
        location = "Branch Office"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/attendance/clock-out" -Method POST -Body $clockOutBody -Headers $empHeaders
    Write-Success "✅ Clock Out successful"
    $testResults += @{ Test = "Clock Out"; Status = "PASS" }
} catch {
    Write-Error "❌ Clock Out failed: $_"
    $testResults += @{ Test = "Clock Out"; Status = "FAIL"; Error = $_.Exception.Message }
}

# Get Monthly Summary
Write-Info "5. Testing Get Monthly Summary..."
try {
    $month = Get-Date -Format "MM"
    $year = Get-Date -Format "yyyy"
    $response = Invoke-RestMethod -Uri "$baseUrl/attendance/summary?month=$month&year=$year" -Method GET -Headers $empHeaders
    Write-Success "✅ Get Monthly Summary successful"
    $testResults += @{ Test = "Get Monthly Summary"; Status = "PASS" }
} catch {
    Write-Error "❌ Get Monthly Summary failed: $_"
    $testResults += @{ Test = "Get Monthly Summary"; Status = "FAIL"; Error = $_.Exception.Message }
}

# List Attendance
Write-Info "6. Testing List Attendance..."
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/attendance" -Method GET -Headers $empHeaders
    Write-Success "✅ List Attendance successful (Found $($response.Count) records)"
    $testResults += @{ Test = "List Attendance"; Status = "PASS" }
} catch {
    Write-Error "❌ List Attendance failed: $_"
    $testResults += @{ Test = "List Attendance"; Status = "FAIL"; Error = $_.Exception.Message }
}

# ============================================
# LEAVE TESTS
# ============================================
Write-Info ""
Write-Info "=== LEAVE TESTS ==="

# Request Leave
Write-Info "7. Testing Request Leave..."
try {
    $startDate = (Get-Date).AddDays(7).ToString("yyyy-MM-dd")
    $endDate = (Get-Date).AddDays(9).ToString("yyyy-MM-dd")
    $leaveBody = @{
        leave_type = "annual"
        start_date = $startDate
        end_date = $endDate
        total_days = 3
        reason = "Family vacation"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/leave/request" -Method POST -Body $leaveBody -Headers $empHeaders
    $leaveId = $response.id
    Write-Success "✅ Request Leave successful (Leave ID: $leaveId)"
    $testResults += @{ Test = "Request Leave"; Status = "PASS" }
} catch {
    Write-Error "❌ Request Leave failed: $_"
    $testResults += @{ Test = "Request Leave"; Status = "FAIL"; Error = $_.Exception.Message }
}

# Get Leave Balance
Write-Info "8. Testing Get Leave Balance..."
try {
    $userId = (Invoke-RestMethod -Uri "$baseUrl/auth/me" -Method GET -Headers $empHeaders).id
    $response = Invoke-RestMethod -Uri "$baseUrl/leave/balance/$userId" -Method GET -Headers $empHeaders
    Write-Success "✅ Get Leave Balance successful"
    Write-Info "   Annual: $($response.annual.remaining) remaining"
    $testResults += @{ Test = "Get Leave Balance"; Status = "PASS" }
} catch {
    Write-Error "❌ Get Leave Balance failed: $_"
    $testResults += @{ Test = "Get Leave Balance"; Status = "FAIL"; Error = $_.Exception.Message }
}

# Approve Leave (as HR)
if ($leaveId) {
    Write-Info "9. Testing Approve Leave..."
    try {
        $approveBody = @{
            notes = "Approved for vacation"
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri "$baseUrl/leave/approve?id=$leaveId" -Method POST -Body $approveBody -Headers $headers
        Write-Success "✅ Approve Leave successful"
        $testResults += @{ Test = "Approve Leave"; Status = "PASS" }
    } catch {
        Write-Error "❌ Approve Leave failed: $_"
        $testResults += @{ Test = "Approve Leave"; Status = "FAIL"; Error = $_.Exception.Message }
    }
}

# List Leave Requests
Write-Info "10. Testing List Leave Requests..."
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/leave/requests" -Method GET -Headers $headers
    Write-Success "✅ List Leave Requests successful (Found $($response.Count) requests)"
    $testResults += @{ Test = "List Leave Requests"; Status = "PASS" }
} catch {
    Write-Error "❌ List Leave Requests failed: $_"
    $testResults += @{ Test = "List Leave Requests"; Status = "FAIL"; Error = $_.Exception.Message }
}

# ============================================
# PAYROLL TESTS
# ============================================
Write-Info ""
Write-Info "=== PAYROLL TESTS ==="

# Calculate Payroll
Write-Info "11. Testing Calculate Payroll..."
try {
    $month = Get-Date -Format "MM"
    $year = Get-Date -Format "yyyy"
    $payrollBody = @{
        period_month = [int]$month
        period_year = [int]$year
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/payroll/calculate" -Method POST -Body $payrollBody -Headers $headers
    Write-Success "✅ Calculate Payroll successful (Calculated $($response.calculatedPayrolls) payrolls)"
    $testResults += @{ Test = "Calculate Payroll"; Status = "PASS" }
} catch {
    Write-Error "❌ Calculate Payroll failed: $_"
    $testResults += @{ Test = "Calculate Payroll"; Status = "FAIL"; Error = $_.Exception.Message }
}

# List Payroll
Write-Info "12. Testing List Payroll..."
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/payroll" -Method GET -Headers $headers
    Write-Success "✅ List Payroll successful (Found $($response.Count) records)"
    if ($response.Count -gt 0) {
        $payrollId = $response[0].id
        $testResults += @{ Test = "List Payroll"; Status = "PASS" }
    }
} catch {
    Write-Error "❌ List Payroll failed: $_"
    $testResults += @{ Test = "List Payroll"; Status = "FAIL"; Error = $_.Exception.Message }
}

# ============================================
# KPI TESTS
# ============================================
Write-Info ""
Write-Info "=== KPI TESTS ==="

# Record KPI
Write-Info "13. Testing Record KPI..."
try {
    $employeeId = (Invoke-RestMethod -Uri "$baseUrl/auth/me" -Method GET -Headers $empHeaders).id
    $empRecord = Invoke-RestMethod -Uri "$baseUrl/employees?userId=$employeeId" -Method GET -Headers $headers
    if ($empRecord -and $empRecord.Count -gt 0) {
        $empId = $empRecord[0].id
    } else {
        throw "Employee not found"
    }
    
    $month = Get-Date -Format "MM"
    $year = Get-Date -Format "yyyy"
    $kpiBody = @{
        employee_id = $empId
        period_month = [int]$month
        period_year = [int]$year
        sales_target_achievement = 95.5
        service_quality_score = 88.0
        customer_satisfaction = 92.0
        attendance_score = 90.0
        overall_score = 91.0
        notes = "Good performance this month"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/kpi/records" -Method POST -Body $kpiBody -Headers $headers
    Write-Success "✅ Record KPI successful (KPI ID: $($response.id))"
    $testResults += @{ Test = "Record KPI"; Status = "PASS" }
} catch {
    Write-Error "❌ Record KPI failed: $_"
    $testResults += @{ Test = "Record KPI"; Status = "FAIL"; Error = $_.Exception.Message }
}

# Get Employee KPIs
Write-Info "14. Testing Get Employee KPIs..."
try {
    $userId = (Invoke-RestMethod -Uri "$baseUrl/auth/me" -Method GET -Headers $empHeaders).id
    $response = Invoke-RestMethod -Uri "$baseUrl/kpi/records/$userId" -Method GET -Headers $headers
    Write-Success "✅ Get Employee KPIs successful (Found $($response.Count) records)"
    $testResults += @{ Test = "Get Employee KPIs"; Status = "PASS" }
} catch {
    Write-Error "❌ Get Employee KPIs failed: $_"
    $testResults += @{ Test = "Get Employee KPIs"; Status = "FAIL"; Error = $_.Exception.Message }
}

# ============================================
# SUMMARY
# ============================================
Write-Info ""
Write-Info "=== TEST SUMMARY ==="
Write-Info ""

$passed = ($testResults | Where-Object { $_.Status -eq "PASS" }).Count
$failed = ($testResults | Where-Object { $_.Status -eq "FAIL" }).Count
$total = $testResults.Count

Write-Info "Total Tests: $total"
Write-Success "Passed: $passed"
if ($failed -gt 0) {
    Write-Error "Failed: $failed"
} else {
    Write-Success "Failed: $failed"
}

Write-Info ""
Write-Info "Detailed Results:"
$testResults | ForEach-Object {
    if ($_.Status -eq "PASS") {
        Write-Success "  ✅ $($_.Test)"
    } else {
        Write-Error "  ❌ $($_.Test): $($_.Error)"
    }
}

