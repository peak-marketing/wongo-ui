# v3.1.2 Billing E2E Test Script
# PowerShell script to test agency billing endpoints

$baseUrl = "http://localhost:3001"

Write-Host "=== 1. Login as agency1 ===" -ForegroundColor Cyan
$loginBody = @{
    email = "agency1@test.com"
    password = "agency123"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
$token = $loginResponse.accessToken
Write-Host "Token obtained: $($token.Substring(0,20))..." -ForegroundColor Green

Write-Host "`n=== 2. Get Wallet Summary ===" -ForegroundColor Cyan
$headers = @{
    Authorization = "Bearer $token"
}
$wallet = Invoke-RestMethod -Uri "$baseUrl/agency/wallet" -Method GET -Headers $headers
Write-Host "Balance: $($wallet.balance) | Reserved: $($wallet.reserved) | Available: $($wallet.available)" -ForegroundColor Green

Write-Host "`n=== 3. Create Topup Request (50,000원) ===" -ForegroundColor Cyan
$topupBody = @{
    amount = 50000
    memo = "테스트 충전"
} | ConvertTo-Json

$idempotencyKey = [guid]::NewGuid().ToString()
$topupHeaders = @{
    Authorization = "Bearer $token"
    "Idempotency-Key" = $idempotencyKey
    "Content-Type" = "application/json"
}

try {
    $topup = Invoke-RestMethod -Uri "$baseUrl/agency/topups" -Method POST -Body $topupBody -Headers $topupHeaders
    Write-Host "✓ Topup created: ID=$($topup.id), Status=$($topup.status)" -ForegroundColor Green
} catch {
    Write-Host "✗ Topup failed: $($_.Exception.Message)" -ForegroundColor Red
    $_.Exception.Response | ConvertTo-Json
}

Write-Host "`n=== 4. Test Amount Validation (400 Expected) ===" -ForegroundColor Cyan
$invalidBody = @{
    amount = 5000  # Below minimum 10,000
    memo = "금액 범위 테스트"
} | ConvertTo-Json

$invalidHeaders = @{
    Authorization = "Bearer $token"
    "Idempotency-Key" = [guid]::NewGuid().ToString()
    "Content-Type" = "application/json"
}

try {
    $invalid = Invoke-RestMethod -Uri "$baseUrl/agency/topups" -Method POST -Body $invalidBody -Headers $invalidHeaders
    Write-Host "✗ Should have failed but got: $invalid" -ForegroundColor Yellow
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "✓ Expected 400, got $statusCode" -ForegroundColor Green
    if ($_.ErrorDetails) {
        $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "  Message: $($errorBody.message)" -ForegroundColor Gray
    }
}

Write-Host "`n=== 5. List Topup Requests ===" -ForegroundColor Cyan
$topups = Invoke-RestMethod -Uri "$baseUrl/agency/topups" -Method GET -Headers $headers
Write-Host "Total topups: $($topups.total)" -ForegroundColor Green
foreach ($item in $topups.items) {
    Write-Host "  - ID: $($item.id.Substring(0,8))... | Amount: $($item.amount) | Status: $($item.status)" -ForegroundColor Gray
}

Write-Host "`n=== 6. List Transactions ===" -ForegroundColor Cyan
$txs = Invoke-RestMethod -Uri "$baseUrl/agency/transactions?pageSize=5" -Method GET -Headers $headers
Write-Host "Total transactions: $($txs.total)" -ForegroundColor Green
foreach ($tx in $txs.items) {
    Write-Host "  - Type: $($tx.type) | Amount: $($tx.amount) | Status: $($tx.status)" -ForegroundColor Gray
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
