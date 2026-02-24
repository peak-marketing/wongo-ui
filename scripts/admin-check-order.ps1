param(
  [Parameter(Mandatory=$true)][string]$OrderId
)

$ErrorActionPreference = 'Stop'

$base = $env:API_BASE_URL
if ([string]::IsNullOrWhiteSpace($base)) { $base = 'http://localhost:3001' }

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$credsPath = Join-Path $root 'admin-login.json'
$outDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$creds = Get-Content -Raw $credsPath | ConvertFrom-Json
$loginBody = @{ email = $creds.email; password = $creds.password } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType 'application/json' -Body $loginBody
$token = @($login.accessToken, $login.access_token, $login.token) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1
if (-not $token) { throw 'No access token' }

$headers = @{ Authorization = "Bearer $token" }
$detail = Invoke-RestMethod -Method Get -Uri "$base/admin/orders/$OrderId" -Headers $headers

$status = $detail.order.status
$reason = $detail.order.lastFailureReason
$ms = [string]$detail.order.manuscript

Write-Host "ORDER_ID=$OrderId"
Write-Host "STATUS=$status"
if ($reason) { Write-Host ("LAST_FAILURE=" + $reason) }

if (-not [string]::IsNullOrWhiteSpace($ms)) {
  $path = Join-Path $outDir "manuscript_$OrderId.txt"
  $ms | Set-Content -Path $path -Encoding utf8
  Write-Host "SAVED=$path"
  Write-Host "CHARCOUNT=$($ms.Length)"
} else {
  Write-Host 'MANUSCRIPT_EMPTY'
}
