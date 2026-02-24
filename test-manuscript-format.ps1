# Manuscript format E2E smoke test
# - Creates an order with local uploads
# - Submits as agency
# - Assigns persona + triggers generation as admin
# - Polls until GENERATED and validates formatting

$ErrorActionPreference = 'Stop'

$baseUrl = "http://localhost:3001"
$uploadsDir = Join-Path $PSScriptRoot "apps/api/uploads"

function Login {
  param(
    [Parameter(Mandatory = $true)][string]$email,
    [Parameter(Mandatory = $true)][string]$password
  )

  $loginBody = (@{ email = $email; password = $password } | ConvertTo-Json)
  $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
  return $res.accessToken
}

function New-TestOrderPayload {
  param(
    [Parameter(Mandatory = $true)][string[]]$photoUrls,
    [Parameter(Mandatory = $true)][object[]]$photoMetas
  )

  $placeName = "TEST_CAFE_$([guid]::NewGuid().ToString('N').Substring(0,8))"

  return @{
    place = @{ name = $placeName; address = '서울 테스트구 테스트로 123' }
    guide = @{
      searchKeywords = @('테스트카페', '원고검증')
      includeText = '문장 단위 줄바꿈과 사진 블록 포맷을 검증합니다. 요. 습니다. 로 끝나는 문장도 줄바꿈되어야 합니다.'
      requiredKeywords = @('분위기', '메뉴', '추천')
      emphasizeKeywords = @('재방문')
      link = $false
      map = $false
      hashtag = $true
      hashtags = @('#테스트', '#원고', '#카페')
    }
    referenceText = '참고 리뷰 텍스트입니다.'
    notes = '자동 E2E 포맷 테스트'
    targetChars = @(1500, 2000)
    photoLimits = @(15, 20)
    photos = $photoUrls
    photoMetas = $photoMetas
    saveAsDraft = $false
    submitCount = 1
  }
}

function Assert-Format {
  param(
    [Parameter(Mandatory = $true)][string]$manuscript
  )

  $normalized = $manuscript -replace "\r\n", "\n"
  $lines = $normalized -split "\n"
  $lastNonEmpty = ($lines | Where-Object { $_.Trim().Length -gt 0 } | Select-Object -Last 1)

  $hashtagLastLine = $false
  if ($null -ne $lastNonEmpty) {
    $hashtagLastLine = $lastNonEmpty.Trim().StartsWith('해시태그:')
  }

  $photoHeaderStandalone = -not [bool]([regex]::Match($normalized, "(?m)^사진\s*\d+\S"))

  # Expect at least one blank line between consecutive photo blocks.
  $blankLineBetweenBlocks = [bool]([regex]::Match($normalized, "(?s)사진\s*\d+\s*\n.*?\n\n사진\s*\d+\s*\n"))

  return [pscustomobject]@{
    hashtagLastLine = $hashtagLastLine
    photoHeaderStandalone = $photoHeaderStandalone
    blankLineBetweenBlocks = $blankLineBetweenBlocks
  }
}

Write-Host "=== 0. Pick 15 upload images ===" -ForegroundColor Cyan
if (-not (Test-Path $uploadsDir)) {
  throw "uploads 폴더를 찾을 수 없습니다: $uploadsDir"
}

$files = Get-ChildItem -Path $uploadsDir -File | Sort-Object LastWriteTime -Descending | Select-Object -First 15
if ($files.Count -lt 15) {
  throw "uploads에 사진이 15장 미만입니다. 현재: $($files.Count)"
}

$photoUrls = @()
$photoMetas = @()
foreach ($f in $files) {
  $url = "$baseUrl/uploads/$([uri]::EscapeDataString($f.Name))"
  $sizeKb = [math]::Ceiling($f.Length / 1kb)
  $photoUrls += $url
  $photoMetas += @{ url = $url; width = 1000; height = 1000; sizeKb = $sizeKb }
}

Write-Host "=== 1. Login as agency ===" -ForegroundColor Cyan
$agencyToken = Login "agency1@test.com" "agency123"
$agencyHeaders = @{ Authorization = "Bearer $agencyToken"; "Content-Type" = "application/json" }

Write-Host "=== 2. Create order ===" -ForegroundColor Cyan
$payload = New-TestOrderPayload -photoUrls $photoUrls -photoMetas $photoMetas
$createBody = ($payload | ConvertTo-Json -Depth 10)
$order = Invoke-RestMethod -Uri "$baseUrl/orders" -Method POST -Headers $agencyHeaders -Body $createBody

$orderId = $order.id
if (-not $orderId) {
  throw "주문 생성 응답에 id가 없습니다: $($order | ConvertTo-Json -Depth 10)"
}
Write-Host "Order created: $orderId" -ForegroundColor Green

Write-Host "=== 3. Submit order ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$baseUrl/agency/orders/$orderId/submit" -Method POST -Headers @{ Authorization = "Bearer $agencyToken" }

Write-Host "=== 4. Login as admin ===" -ForegroundColor Cyan
$adminToken = Login "admin@test.com" "admin123"
$adminHeaders = @{ Authorization = "Bearer $adminToken"; "Content-Type" = "application/json" }

Write-Host "=== 5. Assign persona + Generate ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$baseUrl/admin/orders/$orderId/assign-persona" -Method POST -Headers $adminHeaders -Body (@{ personaId = 'default' } | ConvertTo-Json)
Invoke-RestMethod -Uri "$baseUrl/admin/orders/$orderId/generate" -Method POST -Headers $adminHeaders -Body (@{} | ConvertTo-Json)

Write-Host "=== 6. Poll until GENERATED (max 180s) ===" -ForegroundColor Cyan
$deadline = (Get-Date).AddSeconds(180)
$status = ''
$latest = $null
while ((Get-Date) -lt $deadline) {
  $latest = Invoke-RestMethod -Uri "$baseUrl/admin/orders/$orderId" -Method GET -Headers @{ Authorization = "Bearer $adminToken" }
  $status = $latest.status
  Write-Host "status=$status" -ForegroundColor Gray
  if ($status -eq 'GENERATED') { break }
  Start-Sleep -Seconds 3
}

if ($status -ne 'GENERATED') {
  throw "시간 내 GENERATED가 되지 않았습니다. 마지막 status=$status"
}

$manuscript = [string]$latest.manuscript
if (-not $manuscript.Trim()) {
  throw "manuscript가 비어있습니다"
}

Write-Host "=== 7. Validate format ===" -ForegroundColor Cyan
$check = Assert-Format -manuscript $manuscript
$check | Format-List

Write-Host "=== Preview (first 40 lines) ===" -ForegroundColor Cyan
($manuscript -split "\r\n|\n" | Select-Object -First 40) | ForEach-Object { $_ }
