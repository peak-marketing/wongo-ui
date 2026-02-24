$ErrorActionPreference = 'SilentlyContinue'

Write-Host "=== Kill API-related node.exe processes ===" -ForegroundColor Cyan

$procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $null -ne $_.CommandLine } |
  Where-Object { $_.CommandLine -match 'apps\\api' -or $_.CommandLine -match 'nest\s+start' -or $_.CommandLine -match 'dist\\main' }

if (-not $procs) {
  Write-Host "No matching node.exe processes found." -ForegroundColor Yellow
  exit 0
}

$procs | Select-Object ProcessId,CommandLine | Format-Table -AutoSize

foreach ($p in $procs) {
  $pidText = [string]$p.ProcessId
  $pidNum = 0
  if (-not [int]::TryParse($pidText, [ref]$pidNum) -or $pidNum -le 0) {
    Write-Host "Skip invalid PID: ${pidText}" -ForegroundColor Yellow
    continue
  }
  Write-Host "Stopping PID ${pidNum}..." -ForegroundColor Yellow
  Stop-Process -Id $pidNum -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Milliseconds 300
Write-Host "Done." -ForegroundColor Green
