<#
.SYNOPSIS
    Start all R&G Consulting Control Center services
    
.DESCRIPTION
    Starts PostgreSQL, Redis, MinIO, and the FastAPI application using Docker Compose.
#>

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Starting R&G Control Center Services" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
$envPath = Join-Path $ScriptDir ".env"
if (-not (Test-Path $envPath)) {
    Write-Host "ERROR: .env file not found!" -ForegroundColor Red
    Write-Host "Please run setup.ps1 first" -ForegroundColor Yellow
    exit 1
}

# Load environment variables
Get-Content $envPath | ForEach-Object {
    if ($_ -match "^([^#][^=]+)=(.*)$") {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

# Verify Seagate drive
$seagatePath = $env:SEAGATE_MOUNT
if (-not (Test-Path $seagatePath)) {
    Write-Host "ERROR: Seagate drive not found at $seagatePath" -ForegroundColor Red
    Write-Host "Please ensure the drive is connected and update .env if needed" -ForegroundColor Yellow
    exit 1
}
Write-Host "Seagate drive: $seagatePath" -ForegroundColor Green

# Check Docker
$dockerStatus = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not running" -ForegroundColor Red
    Write-Host "Please start Docker Desktop" -ForegroundColor Yellow
    exit 1
}
Write-Host "Docker: Running" -ForegroundColor Green

# Start services
Write-Host ""
Write-Host "Starting services..." -ForegroundColor Yellow

Set-Location $ScriptDir
docker compose up -d --build

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  Services Started Successfully!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Services:" -ForegroundColor Cyan
    Write-Host "  API:            http://localhost:8000" -ForegroundColor White
    Write-Host "  API Docs:       http://localhost:8000/docs" -ForegroundColor White
    Write-Host "  PostgreSQL:     localhost:5432" -ForegroundColor White
    Write-Host "  Redis:          localhost:6379" -ForegroundColor White
    Write-Host "  MinIO Console:  http://localhost:9001" -ForegroundColor White
    Write-Host ""
    Write-Host "View logs: docker compose logs -f" -ForegroundColor Gray
    Write-Host "Stop:      .\stop-services.ps1" -ForegroundColor Gray
}
else {
    Write-Host ""
    Write-Host "ERROR: Failed to start services" -ForegroundColor Red
    Write-Host "Check logs with: docker compose logs" -ForegroundColor Yellow
}
