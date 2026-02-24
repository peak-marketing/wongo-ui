param(
  [Parameter(Mandatory=$true)][string]$OrderId,
  [string]$BaseUrl = 'http://127.0.0.1:3001',
  [string]$AdminEmail = 'admin@test.com',
  [string]$AdminPassword = 'admin123'
)

$ErrorActionPreference = 'Stop'

$login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType 'application/json' -Body (@{ email=$AdminEmail; password=$AdminPassword } | ConvertTo-Json)
$token = $login.accessToken
if (-not $token) { throw 'admin login failed: accessToken missing' }

$resp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/admin/orders/$OrderId" -Headers @{ Authorization = "Bearer $token" }

$status = $resp.order.status
$manuscript = [string]$resp.order.manuscript

$hasPhoto15 = $false
if ($manuscript) {
  $hasPhoto15 = [regex]::IsMatch($manuscript, '(?m)^사진\s+15\s*$')
}

$hashtagLine = ($manuscript -split "`n" | Where-Object { $_ -match '^해시태그:' } | Select-Object -First 1)
$hashtagCount = 0
if ($hashtagLine) {
  $hashtagCount = [regex]::Matches($hashtagLine, '#[^\s#]+').Count
}

$linkFound = $resp.validationReport.flagsReport.link.found
$mapFound = $resp.validationReport.flagsReport.map.found
$hashtagFound = $resp.validationReport.flagsReport.hashtag.found

Write-Output "status=$status"
Write-Output "hasPhoto15=$hasPhoto15"
Write-Output "hashtagCount=$hashtagCount"
Write-Output "flags linkFound=$linkFound mapFound=$mapFound hashtagFound=$hashtagFound"
