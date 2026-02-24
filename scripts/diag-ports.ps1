$ErrorActionPreference = 'SilentlyContinue'

$ports = @(3000,3001,3002)
Write-Host "=== LISTENERS ===" -ForegroundColor Cyan
$listen = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ports -contains $_.LocalPort } |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Sort-Object LocalPort

if ($null -eq $listen -or $listen.Count -eq 0) {
  Write-Host "(none on 3000/3001/3002)" -ForegroundColor Yellow
} else {
  $listen | Format-Table -AutoSize
}

Write-Host "\n=== PROCESS INFO ===" -ForegroundColor Cyan
$pids = @()
if ($listen) { $pids = $listen | Select-Object -ExpandProperty OwningProcess -Unique }

if ($pids.Count -eq 0) {
  Write-Host "(no owning PIDs found from listeners)" -ForegroundColor Yellow
} else {
  foreach ($pid in $pids) {
    $p = Get-CimInstance Win32_Process -Filter "ProcessId=$pid" -ErrorAction SilentlyContinue
    if ($null -eq $p) {
      Write-Host "PID ${pid}: <not found>" -ForegroundColor Yellow
    } else {
      Write-Host "PID ${pid}: $($p.Name)" -ForegroundColor Green
      Write-Host $p.CommandLine
      Write-Host "---"
    }
  }
}

Write-Host "\n=== NODE PROCESSES (count) ===" -ForegroundColor Cyan
(Get-Process node -ErrorAction SilentlyContinue | Measure-Object).Count
