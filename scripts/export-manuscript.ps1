param(
  [Parameter(Mandatory=$true)][string]$OrderId,
  [string]$BaseUrl = 'http://127.0.0.1:3001',
  [string]$AdminEmail = 'admin@test.com',
  [string]$AdminPassword = 'admin123',
  [string]$OutDir = 'outputs'
)

$ErrorActionPreference = 'Stop'

$login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType 'application/json' -Body (@{ email=$AdminEmail; password=$AdminPassword } | ConvertTo-Json)
$token = $login.accessToken
if (-not $token) { throw 'admin login failed: accessToken missing' }

$resp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/admin/orders/$OrderId" -Headers @{ Authorization = "Bearer $token" }
$manuscript = [string]$resp.order.manuscript
if (-not $manuscript) { throw 'manuscript empty' }

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

$txtPath = Join-Path $OutDir ("manuscript_" + $OrderId + ".txt")
$manuscript | Out-File -FilePath $txtPath -Encoding utf8

Write-Output "saved=$txtPath"
Write-Output "lines=$((($manuscript -replace "`r`n","`n") -split "`n").Count)"
Write-Output "hasPhoto15=$([regex]::IsMatch($manuscript,'(?m)^사진\s+15\s*$'))"
$hashLine = (($manuscript -replace "`r`n","`n") -split "`n" | Where-Object { $_ -match '^해시태그:' } | Select-Object -Last 1)
Write-Output ("hashtagLine=" + $hashLine)
if ($hashLine) {
  Write-Output ("hashtagCount=" + ([regex]::Matches($hashLine,'#[^\s#]+')).Count)
} else {
  Write-Output "hashtagCount=0"
}
