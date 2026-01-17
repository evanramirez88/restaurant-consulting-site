# Toast ABO Worker - Windows Service Installation Script
# R&G Consulting LLC - Toast Auto-Back-Office Automation
#
# This script installs the Toast ABO Worker as a Windows Service using NSSM
# (Non-Sucking Service Manager). The service will start automatically on boot
# and restart on failure.
#
# Prerequisites:
#   - NSSM installed (https://nssm.cc/)
#   - Run this script as Administrator
#
# Usage:
#   .\install-service.ps1                    # Install service
#   .\install-service.ps1 -Uninstall         # Remove service
#   .\install-service.ps1 -NssmPath "C:\path\to\nssm.exe"  # Custom NSSM path
#
# Service Management:
#   nssm start ToastABOWorker    # Start service
#   nssm stop ToastABOWorker     # Stop service
#   nssm restart ToastABOWorker  # Restart service
#   nssm status ToastABOWorker   # Check status
#   nssm edit ToastABOWorker     # Edit configuration GUI

param(
    [switch]$Uninstall = $false,
    [string]$NssmPath = "",
    [string]$ServiceName = "ToastABOWorker"
)

$ErrorActionPreference = "Stop"
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$rootPath = Split-Path -Parent $scriptPath

function Write-Step {
    param([string]$message)
    Write-Host "`n[$([DateTime]::Now.ToString('HH:mm:ss'))] $message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$message)
    Write-Host "  [OK] $message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$message)
    Write-Host "  [WARN] $message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$message)
    Write-Host "  [ERROR] $message" -ForegroundColor Red
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Find-Nssm {
    # Check common locations
    $commonPaths = @(
        "C:\nssm\nssm.exe",
        "C:\Program Files\nssm\nssm.exe",
        "C:\Program Files (x86)\nssm\nssm.exe",
        "$env:USERPROFILE\nssm\nssm.exe",
        "$env:USERPROFILE\Downloads\nssm-2.24\win64\nssm.exe"
    )

    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            return $path
        }
    }

    # Check if nssm is in PATH
    try {
        $nssm = Get-Command nssm -ErrorAction SilentlyContinue
        if ($nssm) {
            return $nssm.Source
        }
    } catch {}

    return $null
}

# Banner
Write-Host @"

===============================================================================
  Toast ABO Worker - Windows Service Installation
  R&G Consulting LLC
===============================================================================

"@ -ForegroundColor Cyan

# Check administrator privileges
if (-not (Test-Administrator)) {
    Write-Error "This script must be run as Administrator"
    Write-Host ""
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Find NSSM
Write-Step "Locating NSSM..."
if ($NssmPath -and (Test-Path $NssmPath)) {
    $nssm = $NssmPath
} else {
    $nssm = Find-Nssm
}

if (-not $nssm) {
    Write-Error "NSSM not found!"
    Write-Host @"

NSSM (Non-Sucking Service Manager) is required to install Windows services.

Download from: https://nssm.cc/download

Installation:
  1. Download nssm-2.24.zip
  2. Extract to C:\nssm\
  3. Run this script again

Or specify custom path:
  .\install-service.ps1 -NssmPath "C:\path\to\nssm.exe"

"@ -ForegroundColor Yellow
    exit 1
}
Write-Success "Found NSSM: $nssm"

# Handle uninstall
if ($Uninstall) {
    Write-Step "Uninstalling service: $ServiceName"

    # Stop service if running
    try {
        & $nssm stop $ServiceName 2>$null
        Start-Sleep -Seconds 2
    } catch {}

    # Remove service
    & $nssm remove $ServiceName confirm

    if ($LASTEXITCODE -eq 0) {
        Write-Success "Service uninstalled successfully"
    } else {
        Write-Warning "Service may not have been installed"
    }
    exit 0
}

# Check for existing service
Write-Step "Checking for existing service..."
$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Warning "Service '$ServiceName' already exists"
    $response = Read-Host "Remove and reinstall? (y/N)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        & $nssm stop $ServiceName 2>$null
        Start-Sleep -Seconds 2
        & $nssm remove $ServiceName confirm
        Start-Sleep -Seconds 1
    } else {
        Write-Host "Installation cancelled" -ForegroundColor Yellow
        exit 0
    }
}

# Get paths
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodePath) {
    Write-Error "Node.js not found in PATH"
    exit 1
}
Write-Success "Node.js: $nodePath"

$scriptFile = Join-Path $rootPath "src\worker.js"
if (-not (Test-Path $scriptFile)) {
    Write-Error "Worker script not found: $scriptFile"
    exit 1
}
Write-Success "Worker script: $scriptFile"

$envFile = Join-Path $rootPath ".env"
if (-not (Test-Path $envFile)) {
    Write-Warning ".env file not found - service may not start correctly"
}

# Install service
Write-Step "Installing service: $ServiceName"

# Install the service
& $nssm install $ServiceName $nodePath $scriptFile
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to install service"
    exit 1
}

# Configure service
Write-Step "Configuring service..."

# Set working directory
& $nssm set $ServiceName AppDirectory $rootPath
Write-Success "Working directory: $rootPath"

# Set environment variables
$envVars = @(
    "NODE_ENV=production"
)
& $nssm set $ServiceName AppEnvironmentExtra ($envVars -join "`n")
Write-Success "Environment variables set"

# Set service description
& $nssm set $ServiceName Description "Toast Auto-Back-Office Automation Worker - R&G Consulting LLC"
& $nssm set $ServiceName DisplayName "Toast ABO Worker"

# Set startup type to automatic (delayed)
& $nssm set $ServiceName Start SERVICE_DELAYED_AUTO_START
Write-Success "Startup type: Automatic (Delayed)"

# Configure failure recovery
& $nssm set $ServiceName AppRestartDelay 10000
Write-Success "Restart delay: 10 seconds on failure"

# Configure logging
$logsPath = Join-Path $rootPath "logs"
if (-not (Test-Path $logsPath)) {
    New-Item -ItemType Directory -Path $logsPath -Force | Out-Null
}

$stdoutLog = Join-Path $logsPath "service-stdout.log"
$stderrLog = Join-Path $logsPath "service-stderr.log"

& $nssm set $ServiceName AppStdout $stdoutLog
& $nssm set $ServiceName AppStderr $stderrLog
& $nssm set $ServiceName AppStdoutCreationDisposition 4  # Append
& $nssm set $ServiceName AppStderrCreationDisposition 4  # Append
& $nssm set $ServiceName AppRotateFiles 1
& $nssm set $ServiceName AppRotateBytes 10485760  # 10MB
Write-Success "Logging configured: $logsPath"

# Summary
Write-Host @"

===============================================================================
  Service Installation Complete!
===============================================================================

Service Name: $ServiceName
Display Name: Toast ABO Worker
Startup Type: Automatic (Delayed Start)
Working Dir:  $rootPath
Log Files:    $logsPath

Service Commands:
  nssm start $ServiceName      # Start service
  nssm stop $ServiceName       # Stop service
  nssm restart $ServiceName    # Restart service
  nssm status $ServiceName     # Check status
  nssm edit $ServiceName       # Edit configuration (GUI)

Alternative (PowerShell):
  Start-Service $ServiceName
  Stop-Service $ServiceName
  Restart-Service $ServiceName
  Get-Service $ServiceName

Log Files:
  stdout: $stdoutLog
  stderr: $stderrLog

"@ -ForegroundColor Green

# Ask to start service
$response = Read-Host "Start service now? (Y/n)"
if ($response -ne 'n' -and $response -ne 'N') {
    Write-Step "Starting service..."
    & $nssm start $ServiceName
    Start-Sleep -Seconds 3

    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq 'Running') {
        Write-Success "Service started successfully!"
    } else {
        Write-Warning "Service may not have started - check logs"
        Write-Host "  Logs: $stderrLog" -ForegroundColor Yellow
    }
}
