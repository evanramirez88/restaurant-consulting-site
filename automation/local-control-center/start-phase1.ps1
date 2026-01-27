# =============================================================================
# Phase 1: Digital Floor - Startup Script
# =============================================================================
# Starts all containers for the Autonomous Architect infrastructure
# Run from: automation/local-control-center/
# =============================================================================

param(
    [string]$SeagateDriveLetter = "S",
    [switch]$Build,
    [switch]$Detach = $true,
    [switch]$Logs
)

$ErrorActionPreference = "Stop"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   R&G Digital Floor - Phase 1 Startup" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check prerequisites
Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Yellow

# Check Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Docker not found. Please install Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check Docker is running
$dockerStatus = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}
Write-Host "  Docker: OK" -ForegroundColor Green

# Check Seagate drive
$SeagatePath = "${SeagateDriveLetter}:\rg_data"
if (-not (Test-Path $SeagatePath)) {
    Write-Host "  Seagate drive not found at ${SeagateDriveLetter}:" -ForegroundColor Yellow
    Write-Host "  Creating directory structure..." -ForegroundColor Yellow

    # Try to create (will fail if drive doesn't exist)
    try {
        New-Item -ItemType Directory -Path $SeagatePath -Force | Out-Null
        New-Item -ItemType Directory -Path "$SeagatePath\postgres" -Force | Out-Null
        New-Item -ItemType Directory -Path "$SeagatePath\redis" -Force | Out-Null
        New-Item -ItemType Directory -Path "$SeagatePath\minio" -Force | Out-Null
        New-Item -ItemType Directory -Path "$SeagatePath\backups" -Force | Out-Null
        New-Item -ItemType Directory -Path "$SeagatePath\clients" -Force | Out-Null
        New-Item -ItemType Directory -Path "$SeagatePath\sync" -Force | Out-Null
        New-Item -ItemType Directory -Path "$SeagatePath\n8n" -Force | Out-Null
        Write-Host "  Directory structure created" -ForegroundColor Green
    } catch {
        Write-Host "ERROR: Cannot access drive ${SeagateDriveLetter}: - Is it mounted?" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  Seagate drive: OK (${SeagatePath})" -ForegroundColor Green
}

# Check .env file
Write-Host "`n[2/6] Checking environment configuration..." -ForegroundColor Yellow

if (-not (Test-Path ".env")) {
    Write-Host "  .env file not found. Creating from template..." -ForegroundColor Yellow

    if (Test-Path ".env.phase1.example") {
        Copy-Item ".env.phase1.example" ".env"

        # Generate random passwords
        $postgresPass = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
        $redisPass = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
        $minioPass = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
        $n8nPass = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 16 | ForEach-Object { [char]$_ })
        $encryptionKey = -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object { [char]$_ })

        # Update .env with generated values
        $envContent = Get-Content ".env" -Raw
        $envContent = $envContent -replace "CHANGE_ME_SECURE_PASSWORD", $postgresPass
        $envContent = $envContent -replace "CHANGE_ME_REDIS_PASSWORD", $redisPass
        $envContent = $envContent -replace "CHANGE_ME_MINIO_PASSWORD", $minioPass
        $envContent = $envContent -replace "CHANGE_ME_N8N_PASSWORD", $n8nPass
        $envContent = $envContent -replace "N8N_ENCRYPTION_KEY=`n", "N8N_ENCRYPTION_KEY=$encryptionKey`n"
        $envContent = $envContent -replace "SEAGATE_MOUNT=S:", "SEAGATE_MOUNT=${SeagateDriveLetter}:"
        Set-Content ".env" $envContent

        Write-Host "  .env created with generated passwords" -ForegroundColor Green
        Write-Host "  IMPORTANT: Review and update API keys in .env" -ForegroundColor Yellow
    } else {
        Write-Host "ERROR: .env.phase1.example not found" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  .env file: OK" -ForegroundColor Green
}

# Set environment variable for Docker Compose
$env:SEAGATE_MOUNT = "${SeagateDriveLetter}:"

# Build containers if requested
Write-Host "`n[3/6] Preparing containers..." -ForegroundColor Yellow

if ($Build) {
    Write-Host "  Building browser-service..." -ForegroundColor Cyan
    docker compose -f docker-compose.phase1.yml build browser-service

    Write-Host "  Building api..." -ForegroundColor Cyan
    docker compose -f docker-compose.phase1.yml build api
}

# Pull latest images
Write-Host "  Pulling latest images..." -ForegroundColor Cyan
docker compose -f docker-compose.phase1.yml pull --quiet

# Start containers
Write-Host "`n[4/6] Starting containers..." -ForegroundColor Yellow

$composeArgs = @("-f", "docker-compose.phase1.yml", "up")
if ($Detach) {
    $composeArgs += "-d"
}

docker compose @composeArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to start containers" -ForegroundColor Red
    exit 1
}

# Wait for services to be healthy
Write-Host "`n[5/6] Waiting for services to be healthy..." -ForegroundColor Yellow

$services = @("postgres", "redis", "minio", "n8n", "browser-service", "nginx")
$maxWait = 120
$waited = 0

foreach ($service in $services) {
    Write-Host "  Waiting for $service..." -NoNewline

    while ($waited -lt $maxWait) {
        $health = docker inspect --format='{{.State.Health.Status}}' "rg-$service" 2>$null

        if ($health -eq "healthy" -or $health -eq $null) {
            # No health check or healthy
            $running = docker inspect --format='{{.State.Running}}' "rg-$service" 2>$null
            if ($running -eq "true") {
                Write-Host " OK" -ForegroundColor Green
                break
            }
        }

        Start-Sleep -Seconds 2
        $waited += 2
        Write-Host "." -NoNewline
    }

    if ($waited -ge $maxWait) {
        Write-Host " TIMEOUT" -ForegroundColor Red
    }

    $waited = 0
}

# Display access information
Write-Host "`n[6/6] Services are ready!" -ForegroundColor Green
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   ACCESS INFORMATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n  Dashboard:       http://localhost/" -ForegroundColor White
Write-Host "  n8n Workflows:   http://localhost:5678/" -ForegroundColor White
Write-Host "  Browser Service: http://localhost:3000/health" -ForegroundColor White
Write-Host "  Control API:     http://localhost:8000/docs" -ForegroundColor White
Write-Host "  MinIO Console:   http://localhost:9001/" -ForegroundColor White
Write-Host "  PostgreSQL:      localhost:5432" -ForegroundColor White
Write-Host "  Redis:           localhost:6379" -ForegroundColor White

Write-Host "`n  Tailscale Access:" -ForegroundColor Yellow
Write-Host "  http://sage-lenovo.tail0fa33b.ts.net:5678 (n8n)" -ForegroundColor Gray
Write-Host "  http://100.72.223.35:8000 (API)" -ForegroundColor Gray

if ($Logs) {
    Write-Host "`n  Following logs (Ctrl+C to exit)..." -ForegroundColor Yellow
    docker compose -f docker-compose.phase1.yml logs -f
}

Write-Host "`n========================================`n" -ForegroundColor Cyan
