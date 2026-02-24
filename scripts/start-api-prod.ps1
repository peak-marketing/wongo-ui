param(
  [int]$Port = 3001
)

$ErrorActionPreference = 'Stop'

Set-Location (Join-Path $PSScriptRoot '..' | Resolve-Path)

$env:PORT = "$Port"

Write-Host "Starting API on port $Port (pnpm -C apps/api start)" -ForegroundColor Cyan
pnpm -C apps/api start
