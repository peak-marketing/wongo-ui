param(
  [string]$RepoRoot = $PSScriptRoot,
  [switch]$CleanWeb,
  [switch]$WatchWeb,
  [switch]$WatchWebBackground,
  [string]$WatchUrl = "http://localhost:3000/admin/intake",
  [int]$WatchIntervalSeconds = 5,
  [int]$WatchFailThreshold = 2
)

Set-Location -LiteralPath $RepoRoot

$LogDir = Join-Path $RepoRoot "logs"
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

function Test-ListeningPort([int]$Port) {
  return [bool](Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' } | Select-Object -First 1)
}

function Wait-ListeningPort([int]$Port, [int]$TimeoutSeconds = 10) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-ListeningPort $Port) { return $true }
    Start-Sleep -Milliseconds 250
  }
  return (Test-ListeningPort $Port)
}

function Stop-ListeningPort([int]$Port) {
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -eq $conn) { return $false }
  try {
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction Stop
    Start-Sleep -Milliseconds 300
    return $true
  } catch {
    return $false
  }
}

function Start-WebDev() {
  $webOut = Join-Path $LogDir "web-dev.out.log"
  $webErr = Join-Path $LogDir "web-dev.err.log"
  Start-Process -FilePath "cmd.exe" -ArgumentList @("/c","pnpm -C apps/web dev") -WorkingDirectory $RepoRoot -WindowStyle Hidden -RedirectStandardOutput $webOut -RedirectStandardError $webErr | Out-Null
  [void](Wait-ListeningPort 3000 15)
}

function Repair-WebDev() {
  Write-Host "- RepairWeb: stopping port 3000 + removing apps/web/.next" -ForegroundColor DarkCyan
  [void](Stop-ListeningPort 3000)
  $nextDir = Join-Path $RepoRoot "apps/web/.next"
  if (Test-Path -LiteralPath $nextDir) {
    try { Remove-Item -LiteralPath $nextDir -Recurse -Force -ErrorAction Stop } catch { }
  }
  Start-WebDev
}

function Test-WebHealth([string]$Url) {
  try {
    $htmlResp = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec 8
    if ($htmlResp.StatusCode -ge 400) { return $false }

    $html = [string]$htmlResp.Content
    if (-not $html) { return $false }

    # If the document loads but static assets are failing (500), the UI becomes blank.
    # Extract a stable-looking Next.js chunk URL from HTML and validate it returns 200.
    $m = [regex]::Match($html, '(?i)(/_next/static/[^"'']+?\.js)')
    if (-not $m.Success) {
      # Fallback: if HTML doesn't reference chunks (unexpected), treat as unhealthy.
      return $false
    }

    $assetPath = $m.Groups[1].Value
    $base = "http://localhost:3000"
    $assetUrl = $base + $assetPath
    $assetResp = Invoke-WebRequest -Uri $assetUrl -Method GET -UseBasicParsing -TimeoutSec 8
    if ($assetResp.StatusCode -ge 400) { return $false }
    return $true
  } catch {
    return $false
  }
}

function Write-WatchLog([string]$Message) {
  $stamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  $line = "[$stamp] $Message"
  $logPath = Join-Path $LogDir "web-watch.log"
  try { Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8 } catch { }
}

if ($WatchWebBackground) {
  $self = $PSCommandPath
  if (-not $self) { $self = Join-Path $RepoRoot "dev-up.ps1" }
  $args = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$self`"",
    "-RepoRoot", "`"$RepoRoot`"",
    "-WatchWeb",
    "-WatchUrl", "`"$WatchUrl`"",
    "-WatchIntervalSeconds", $WatchIntervalSeconds,
    "-WatchFailThreshold", $WatchFailThreshold
  )
  $watchOut = Join-Path $LogDir "web-watch.out.log"
  $watchErr = Join-Path $LogDir "web-watch.err.log"
  $psExe = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"
  if (-not (Test-Path -LiteralPath $psExe)) { $psExe = "powershell.exe" }

  $p = Start-Process -FilePath $psExe -ArgumentList $args -WorkingDirectory $RepoRoot -WindowStyle Hidden -RedirectStandardOutput $watchOut -RedirectStandardError $watchErr -PassThru

  $pidFile = Join-Path $LogDir "web-watch.pid"
  try { Set-Content -LiteralPath $pidFile -Value "$($p.Id)" -Encoding ASCII } catch { }

  Write-Host "Web watchdog started in background. (pid=$($p.Id), url=$WatchUrl, interval=${WatchIntervalSeconds}s)" -ForegroundColor Green
  return
}

Write-Host "[1/3] DB containers (pg16, redis7)" -ForegroundColor Cyan
try {
  docker start pg16 redis7 | Out-Null
} catch {
  Write-Warning "docker start failed. Is Docker Desktop running?"
}

Write-Host "[2/3] Web (Next.js)" -ForegroundColor Cyan

if ($CleanWeb) {
  Write-Host "- CleanWeb: stopping port 3000 + removing apps/web/.next" -ForegroundColor DarkCyan
  [void](Stop-ListeningPort 3000)
  $nextDir = Join-Path $RepoRoot "apps/web/.next"
  if (Test-Path -LiteralPath $nextDir) {
    try { Remove-Item -LiteralPath $nextDir -Recurse -Force -ErrorAction Stop } catch { }
  }
}

if (-not (Test-ListeningPort 3000)) {
  Start-WebDev
}

Write-Host "[3/3] API (NestJS)" -ForegroundColor Cyan
if (-not (Test-ListeningPort 3001)) {
  $apiOut = Join-Path $LogDir "api-dev.out.log"
  $apiErr = Join-Path $LogDir "api-dev.err.log"
  Start-Process -FilePath "cmd.exe" -ArgumentList @("/c","pnpm -C apps/api dev") -WorkingDirectory $RepoRoot -WindowStyle Hidden -RedirectStandardOutput $apiOut -RedirectStandardError $apiErr | Out-Null
  [void](Wait-ListeningPort 3001 10)
}

$webOk = Test-ListeningPort 3000
$apiOk = Test-ListeningPort 3001

Write-Host "Web  : http://localhost:3000  (listening=$webOk)"
Write-Host "API  : http://localhost:3001  (listening=$apiOk)"
Write-Host "PG   : localhost:5432"
Write-Host "Redis: localhost:6379"

if ($WatchWeb) {
  Write-Host "Web watchdog running... (url=$WatchUrl, interval=${WatchIntervalSeconds}s)" -ForegroundColor Cyan
  Write-WatchLog "START url=$WatchUrl interval=${WatchIntervalSeconds}s failThreshold=$WatchFailThreshold"

  $pidFile = Join-Path $LogDir "web-watch.pid"
  if (Test-Path -LiteralPath $pidFile) {
    try {
      $existingPid = (Get-Content -LiteralPath $pidFile -ErrorAction Stop | Select-Object -First 1).Trim()
      if ($existingPid) {
        $p = Get-Process -Id ([int]$existingPid) -ErrorAction SilentlyContinue
        if ($p) {
          Write-Host "Web watchdog already running. (pid=$existingPid)" -ForegroundColor Yellow
          return
        }
      }
    } catch { }
  }
  try { Set-Content -LiteralPath $pidFile -Value "$PID" -Encoding ASCII } catch { }

  $failCount = 0
  Start-Sleep -Seconds 2
  while ($true) {
    $ok = Test-WebHealth $WatchUrl
    if ($ok) {
      if ($failCount -ne 0) {
        Write-WatchLog "HEALTH_OK after ${failCount} failures"
      }
      $failCount = 0
    } else {
      $failCount += 1
      Write-WatchLog "HEALTH_FAIL count=$failCount"
      if ($failCount -ge $WatchFailThreshold) {
        Write-WatchLog "REPAIR_TRIGGER"
        Repair-WebDev
        $failCount = 0
        Write-WatchLog "REPAIR_DONE"
      }
    }

    Start-Sleep -Seconds $WatchIntervalSeconds
  }
}
