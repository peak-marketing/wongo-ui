$ErrorActionPreference = 'Stop'

$base = $env:API_BASE_URL
if ([string]::IsNullOrWhiteSpace($base)) {
  $base = 'http://localhost:3001'
}

$workspaceRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$credsPath = Join-Path $workspaceRoot 'admin-login.json'
$outDir = Join-Path $workspaceRoot 'logs'

if (-not (Test-Path $credsPath)) {
  throw "Missing credentials file: $credsPath"
}

$creds = Get-Content -Raw $credsPath | ConvertFrom-Json

$loginBody = @{ email = $creds.email; password = $creds.password } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType 'application/json' -Body $loginBody

$token = @($login.accessToken, $login.access_token, $login.token) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1
if (-not $token) {
  throw 'No access token in login response'
}

$headers = @{ Authorization = "Bearer $token" }

$orders = Invoke-RestMethod -Method Get -Uri "$base/admin/orders" -Headers $headers
if ($orders -isnot [System.Array]) { $orders = @($orders) }
if ($orders.Count -lt 1) { throw 'No orders found' }

$latest = $orders[0]
Write-Host "LATEST_ORDER_ID=$($latest.id) STATUS=$($latest.status)"

$gen = Invoke-RestMethod -Method Post -Uri "$base/admin/orders/$($latest.id)/generate" -Headers $headers -ContentType 'application/json' -Body '{}'
Write-Host "GEN_QUEUED jobId=$($gen.jobId)"

# Poll status (up to 10 minutes)
$detail = $null
for ($i = 0; $i -lt 300; $i++) {
  Start-Sleep -Seconds 2
  $detail = Invoke-RestMethod -Method Get -Uri "$base/admin/orders/$($latest.id)" -Headers $headers
  $status = $detail.order.status
  if ($i % 10 -eq 0) {
    Write-Host "POLL status=$status"
  }
  if ($status -ne 'GENERATING' -and $status -ne 'REGEN_QUEUED' -and $status -ne 'ADMIN_INTAKE') {
    break
  }
}

if (-not $detail) {
  $detail = Invoke-RestMethod -Method Get -Uri "$base/admin/orders/$($latest.id)" -Headers $headers
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

($detail.order | ConvertTo-Json -Depth 50) | Set-Content -Path (Join-Path $outDir 'latest-order.json') -Encoding utf8

$ms = $detail.order.manuscript
if ([string]::IsNullOrWhiteSpace($ms)) {
  Write-Host 'NO_MANUSCRIPT_TEXT'
} else {
  $ms | Set-Content -Path (Join-Path $outDir 'latest-manuscript.txt') -Encoding utf8
  Write-Host "SAVED_MANUSCRIPT=$([IO.Path]::Combine($outDir, 'latest-manuscript.txt'))"
  Write-Host "CHARCOUNT=$($ms.Length)"
}

if ($detail.validationReport) {
  ($detail.validationReport | ConvertTo-Json -Depth 20) | Set-Content -Path (Join-Path $outDir 'latest-validation.json') -Encoding utf8
  Write-Host "SAVED_VALIDATION=$([IO.Path]::Combine($outDir, 'latest-validation.json'))"
}

Write-Host "FINAL_STATUS=$($detail.order.status)"
