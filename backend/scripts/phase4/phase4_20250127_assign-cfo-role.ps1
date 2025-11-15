# Script to assign CFO role to test user
# This script directly updates the database to assign the CFO role

$baseUrl = "http://localhost:3000/api/v1"
$email = "cfo@igdgroup.com"

Write-Host "=== Assigning CFO Role to Test User ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Login
Write-Host "1. Logging in..." -ForegroundColor Yellow
$loginBody = @{
    email = $email
    password = "Admin123!"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.data.access_token
    $userId = $loginResponse.data.user.id
    Write-Host "   [OK] Login successful" -ForegroundColor Green
    Write-Host "   User ID: $userId" -ForegroundColor Gray
} catch {
    Write-Host "   [FAIL] Login failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Please register the user first" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Step 2: Get user info to find user ID
Write-Host "2. Getting user information..." -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

try {
    $userResponse = Invoke-RestMethod -Uri "$baseUrl/auth/me" -Method GET -Headers $headers
    $userId = $userResponse.data.id
    Write-Host "   [OK] User ID: $userId" -ForegroundColor Green
} catch {
    Write-Host "   [WARN] Could not get user info, using ID from login" -ForegroundColor Yellow
}

Write-Host ""

# Step 3: Check if we can get roles list (might need to query database directly)
Write-Host "3. Checking available roles..." -ForegroundColor Yellow
Write-Host "   [INFO] Need to assign role via database" -ForegroundColor Yellow
Write-Host "   [INFO] Please run the SQL script: assign-cfo-role.sql" -ForegroundColor Yellow
Write-Host ""

Write-Host "=== Alternative: Direct Database Assignment ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Run this SQL in your PostgreSQL database:" -ForegroundColor Yellow
Write-Host ""
Write-Host "-- Get user ID" -ForegroundColor Gray
Write-Host "SELECT id, email FROM users WHERE email = '$email';" -ForegroundColor White
Write-Host ""
Write-Host "-- Get CFO role ID (create if doesn't exist)" -ForegroundColor Gray
Write-Host "SELECT id, code FROM roles WHERE code = 'CFO';" -ForegroundColor White
Write-Host ""
Write-Host "-- If CFO role doesn't exist, create it:" -ForegroundColor Gray
Write-Host "INSERT INTO roles (id, code, name, description, level, is_system_role, is_active, created_at, updated_at)" -ForegroundColor White
Write-Host "VALUES (" -ForegroundColor White
Write-Host "    gen_random_uuid()," -ForegroundColor White
Write-Host "    'CFO'," -ForegroundColor White
Write-Host "    'Chief Financial Officer'," -ForegroundColor White
Write-Host "    'Full access to Finance and Accounting module'," -ForegroundColor White
Write-Host "    2," -ForegroundColor White
Write-Host "    false," -ForegroundColor White
Write-Host "    true," -ForegroundColor White
Write-Host "    NOW()," -ForegroundColor White
Write-Host "    NOW()" -ForegroundColor White
Write-Host ") ON CONFLICT (code) DO NOTHING;" -ForegroundColor White
Write-Host ""
Write-Host "-- Assign CFO role to user (replace <user_id> and <role_id> with actual values)" -ForegroundColor Gray
Write-Host "INSERT INTO user_roles (id, user_id, role_id, branch_id, is_primary, valid_from, created_at, updated_at)" -ForegroundColor White
Write-Host "VALUES (" -ForegroundColor White
Write-Host "    gen_random_uuid()," -ForegroundColor White
Write-Host "    '<user_id>'," -ForegroundColor White
Write-Host "    '<role_id>'," -ForegroundColor White
Write-Host "    NULL," -ForegroundColor White
Write-Host "    true," -ForegroundColor White
Write-Host "    NOW()," -ForegroundColor White
Write-Host "    NOW()," -ForegroundColor White
Write-Host "    NOW()" -ForegroundColor White
Write-Host ") ON CONFLICT (user_id, role_id, branch_id) DO NOTHING;" -ForegroundColor White
Write-Host ""

Write-Host "=== Or use Prisma Studio ===" -ForegroundColor Cyan
Write-Host "Run: npx prisma studio" -ForegroundColor Yellow
Write-Host "Then manually assign the CFO role to the user" -ForegroundColor Yellow

