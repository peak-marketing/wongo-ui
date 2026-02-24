$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location -LiteralPath $root

$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$conn = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) {
  try { Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
  Start-Sleep -Milliseconds 500
}

$out = Join-Path $logDir 'api-dev.out.log'
$err = Join-Path $logDir 'api-dev.err.log'

Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c','pnpm -C apps/api dev') -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err | Out-Null

$deadline = (Get-Date).AddSeconds(20)
$ok = $false
while ((Get-Date) -lt $deadline) {
  try {
    $code = (Invoke-WebRequest -Uri 'http://localhost:3001/health' -UseBasicParsing -TimeoutSec 2).StatusCode
    if ($code -eq 200) { $ok = $true; break }
  } catch {}
  Start-Sleep -Milliseconds 500
}

if ($ok) {
  Write-Host 'API_DEV_UP=200'
} else {
  Write-Host 'API_DEV_UP=NO'
  Write-Host ('Check logs: ' + $out)
  Write-Host ('Check logs: ' + $err)
}
