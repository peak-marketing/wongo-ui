param(
  [Parameter(Mandatory=$true)][string]$OrderId,
  [string]$BaseUrl = 'http://127.0.0.1:3001',
  [string]$AdminEmail = 'admin@test.com',
  [string]$AdminPassword = 'admin123',
  [int]$TimeoutSec = 600,
  [int]$IntervalSec = 5
)

$ErrorActionPreference = 'Stop'

$login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType 'application/json' -Body (@{ email=$AdminEmail; password=$AdminPassword } | ConvertTo-Json)
$token = $login.accessToken
if (-not $token) { throw 'admin login failed: accessToken missing' }

$deadline = (Get-Date).AddSeconds($TimeoutSec)

while ($true) {
  $resp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/admin/orders/$OrderId" -Headers @{ Authorization = "Bearer $token" }
  $status = $resp.order.status

  if ($status -ne 'GENERATING' -and $status -ne 'ADMIN_INTAKE') {
    break
  }

  if ((Get-Date) -gt $deadline) {
    throw "timeout waiting for order: $OrderId (lastStatus=$status)"
  }

  Write-Output "status=$status (waiting...)"
  Start-Sleep -Seconds $IntervalSec
}

& "$PSScriptRoot/inspect-order.ps1" -OrderId $OrderId -BaseUrl $BaseUrl -AdminEmail $AdminEmail -AdminPassword $AdminPassword
