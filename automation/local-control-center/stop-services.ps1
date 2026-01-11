<#
.SYNOPSIS
    Stop all R&G Consulting Control Center services
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Stopping R&G Control Center services..." -ForegroundColor Yellow

Set-Location $ScriptDir
docker compose down

if ($LASTEXITCODE -eq 0) {
    Write-Host "All services stopped." -ForegroundColor Green
}
else {
    Write-Host "Warning: Some services may not have stopped cleanly." -ForegroundColor Yellow
}
