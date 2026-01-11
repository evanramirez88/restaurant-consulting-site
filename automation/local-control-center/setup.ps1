<#
.SYNOPSIS
    Setup script for R&G Consulting Local Control Center
    
.DESCRIPTION
    This script prepares the Lenovo PC (SAGE-LENOVO) with the 20TB Seagate drive
    for running the local control center infrastructure.
    
.PARAMETER SeagateDriveLetter
    The drive letter where the Seagate drive is mounted (e.g., "S", "D", "E")
    
.EXAMPLE
    .\setup.ps1 -SeagateDriveLetter "S"
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidatePattern("^[A-Z]$")]
    [string]$SeagateDriveLetter,
    
    [Parameter(Mandatory=$false)]
    [string]$PostgresPassword = "rg_secure_$(Get-Random -Maximum 9999)",
    
    [Parameter(Mandatory=$false)]
    [string]$RedisPassword = "rg_redis_$(Get-Random -Maximum 9999)",
    
    [Parameter(Mandatory=$false)]
    [string]$MinioPassword = "rg_minio_$(Get-Random -Maximum 9999)"
)

$ErrorActionPreference = "Stop"
$SeagatePath = "${SeagateDriveLetter}:"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  R&G Consulting Local Control Center Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Verify Seagate drive is accessible
if (-not (Test-Path $SeagatePath)) {
    Write-Host "ERROR: Drive $SeagatePath not found!" -ForegroundColor Red
    Write-Host "Please ensure the 20TB Seagate drive is connected and mounted at $SeagatePath" -ForegroundColor Yellow
    exit 1
}

$driveInfo = Get-Volume -DriveLetter $SeagateDriveLetter -ErrorAction SilentlyContinue
if ($driveInfo) {
    $sizeGB = [math]::Round($driveInfo.Size / 1GB, 2)
    $freeGB = [math]::Round($driveInfo.SizeRemaining / 1GB, 2)
    Write-Host "Found drive $SeagatePath - $sizeGB GB total, $freeGB GB free" -ForegroundColor Green
} else {
    Write-Host "WARNING: Could not get drive info for $SeagatePath" -ForegroundColor Yellow
}

# Create directory structure on Seagate drive
Write-Host ""
Write-Host "Creating directory structure on $SeagatePath..." -ForegroundColor Yellow

$directories = @(
    "$SeagatePath\rg_data",
    "$SeagatePath\rg_data\postgres",
    "$SeagatePath\rg_data\redis",
    "$SeagatePath\rg_data\minio",
    "$SeagatePath\rg_data\clients",
    "$SeagatePath\rg_data\backups",
    "$SeagatePath\rg_data\sync",
    "$SeagatePath\rg_data\logs"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  Created: $dir" -ForegroundColor Gray
    } else {
        Write-Host "  Exists:  $dir" -ForegroundColor DarkGray
    }
}

# Check for Docker
Write-Host ""
Write-Host "Checking Docker installation..." -ForegroundColor Yellow

$dockerVersion = docker --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    exit 1
}
Write-Host "  Docker: $dockerVersion" -ForegroundColor Green

$composeVersion = docker compose version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker Compose is not available" -ForegroundColor Red
    exit 1
}
Write-Host "  Compose: $composeVersion" -ForegroundColor Green

# Create .env file
Write-Host ""
Write-Host "Creating environment configuration..." -ForegroundColor Yellow

$envContent = @"
# R&G Consulting Local Control Center Configuration
# Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

# Seagate Drive Mount Path
SEAGATE_MOUNT=$SeagatePath

# PostgreSQL Configuration
POSTGRES_PASSWORD=$PostgresPassword

# Redis Configuration
REDIS_PASSWORD=$RedisPassword

# MinIO Configuration (S3-compatible storage)
MINIO_ROOT_USER=rg_admin
MINIO_ROOT_PASSWORD=$MinioPassword

# Cloudflare Sync (optional)
CLOUDFLARE_SYNC_ENABLED=false
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=373a6cef1f9ccf5d26bfd9687a91c0a6
"@

$envPath = Join-Path $PSScriptRoot ".env"
$envContent | Out-File -FilePath $envPath -Encoding utf8 -Force
Write-Host "  Created: $envPath" -ForegroundColor Green

# Save credentials separately for reference
$credentialsContent = @"
# R&G Consulting Local Control Center Credentials
# Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# KEEP THIS FILE SECURE!

PostgreSQL:
  Host: localhost:5432 (or sage-lenovo:5432)
  Database: rg_consulting
  Username: rg_admin
  Password: $PostgresPassword

Redis:
  Host: localhost:6379
  Password: $RedisPassword

MinIO:
  Console: http://localhost:9001
  API: http://localhost:9000
  Access Key: rg_admin
  Secret Key: $MinioPassword

API:
  URL: http://localhost:8000
  Docs: http://localhost:8000/docs
"@

$credentialsPath = Join-Path $SeagatePath "rg_data\CREDENTIALS.txt"
$credentialsContent | Out-File -FilePath $credentialsPath -Encoding utf8 -Force
Write-Host "  Credentials saved to: $credentialsPath" -ForegroundColor Green

# Configure Windows Firewall
Write-Host ""
Write-Host "Configuring Windows Firewall rules..." -ForegroundColor Yellow

$firewallRules = @(
    @{Name="RG-PostgreSQL"; Port=5432; Protocol="TCP"},
    @{Name="RG-Redis"; Port=6379; Protocol="TCP"},
    @{Name="RG-API"; Port=8000; Protocol="TCP"},
    @{Name="RG-MinIO-API"; Port=9000; Protocol="TCP"},
    @{Name="RG-MinIO-Console"; Port=9001; Protocol="TCP"}
)

foreach ($rule in $firewallRules) {
    $existing = Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue
    if (-not $existing) {
        try {
            New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Protocol $rule.Protocol -LocalPort $rule.Port -Action Allow | Out-Null
            Write-Host "  Created firewall rule: $($rule.Name) (port $($rule.Port))" -ForegroundColor Gray
        } catch {
            Write-Host "  WARNING: Could not create firewall rule for $($rule.Name). Run as Administrator." -ForegroundColor Yellow
        }
    } else {
        Write-Host "  Exists: $($rule.Name)" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Review the .env file and update passwords if desired" -ForegroundColor White
Write-Host "  2. Run: .\start-services.ps1" -ForegroundColor White
Write-Host "  3. Access the API at: http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "Credentials saved to: $credentialsPath" -ForegroundColor Yellow
