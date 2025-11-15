# Quick test to verify role assignment and token
$baseUrl = "http://localhost:3000/api/v1"

Write-Host "=== Role Verification Test ===" -ForegroundColor Cyan
Write-Host ""

# Login
$loginBody = @{
    email = "cfo@igdgroup.com"
    password = "Admin123!"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.data.access_token
    $user = $loginResponse.data.user
    
    Write-Host "Login successful" -ForegroundColor Green
    Write-Host "User ID: $($user.id)" -ForegroundColor Gray
    Write-Host "User Email: $($user.email)" -ForegroundColor Gray
    Write-Host "User Roles: $($user.roles -join ', ')" -ForegroundColor Yellow
    
    if ($user.roles -contains "CFO") {
        Write-Host "OK: CFO role found in token!" -ForegroundColor Green
    } else {
        Write-Host "FAIL: CFO role NOT found in token" -ForegroundColor Red
        Write-Host "Roles in token: $($user.roles -join ', ')" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Testing /auth/me endpoint..." -ForegroundColor Yellow
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    $meResponse = Invoke-RestMethod -Uri "$baseUrl/auth/me" -Method GET -Headers $headers
    Write-Host "Roles from /auth/me: $($meResponse.data.roles -join ', ')" -ForegroundColor Yellow
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
