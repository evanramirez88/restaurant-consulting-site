# Toast ABO Worker Start Script
# R&G Consulting LLC - Toast Auto-Back-Office Automation
#
# This script starts the Toast ABO Worker with proper environment configuration.
#
# Usage:
#   .\start.ps1              # Start in foreground
#   .\start.ps1 -Background  # Start in background (new window)
#   .\start.ps1 -Dev         # Start with auto-reload (development mode)
#
# Environment Variables (loaded from .env):
#   API_BASE_URL     - Cloudflare backend URL
#   WORKER_API_KEY   - API key for authentication
#   ENCRYPTION_KEY   - Key for decrypting Toast credentials
#   HEADLESS         - Run browser headless (true/false)
#   MAX_SESSIONS     - Max concurrent browser sessions
#   LOG_LEVEL        - Logging level (debug/info/warn/error)

param(
    [switch]$Background = $false,
    [switch]$Dev = $false,
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Stop"
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$rootPath = Split-Path -Parent $scriptPath

function Write-Log {
    param([string]$message, [string]$level = "INFO")
    $timestamp = [DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss')
    $color = switch ($level) {
        "ERROR" { "Red" }
        "WARN" { "Yellow" }
        "INFO" { "Cyan" }
        default { "White" }
    }
    Write-Host "[$timestamp] [$level] $message" -ForegroundColor $color
}

# Banner
Write-Host @"

===============================================================================
  Toast ABO Worker
  R&G Consulting LLC
===============================================================================

"@ -ForegroundColor Cyan

# Change to project root
Set-Location $rootPath
Write-Log "Working directory: $rootPath"

# Check if .env exists
$envPath = Join-Path $rootPath ".env"
if (-not (Test-Path $envPath)) {
    Write-Log ".env file not found. Run install.ps1 first." "ERROR"
    Write-Host ""
    Write-Host "To install:" -ForegroundColor Yellow
    Write-Host "  .\scripts\install.ps1" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Validate critical environment variables
Write-Log "Validating configuration..."
$envContent = Get-Content $envPath -Raw

$hasApiKey = $envContent -match "WORKER_API_KEY=(?!your-worker-api-key)"
$hasEncryptionKey = $envContent -match "ENCRYPTION_KEY=(?!your-encryption-key)"

if (-not $hasApiKey) {
    Write-Log "WORKER_API_KEY not configured in .env" "WARN"
}
if (-not $hasEncryptionKey) {
    Write-Log "ENCRYPTION_KEY not configured in .env" "WARN"
}

# Check if node_modules exists
$nodeModulesPath = Join-Path $rootPath "node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Log "Dependencies not installed. Run install.ps1 first." "ERROR"
    exit 1
}

# Build the command
$nodeArgs = @()

if ($Dev) {
    $nodeArgs += "--watch"
    Write-Log "Development mode enabled (auto-reload)"
}

$nodeArgs += "src/worker.js"

# Start the worker
if ($Background) {
    Write-Log "Starting worker in background (new window)..."
    $processArgs = @{
        FilePath = "node"
        ArgumentList = $nodeArgs -join " "
        WorkingDirectory = $rootPath
        WindowStyle = "Normal"
    }
    Start-Process @processArgs
    Write-Log "Worker started in new window"
    Write-Host ""
    Write-Host "To stop the worker, close the worker window or use Task Manager." -ForegroundColor Yellow
} else {
    Write-Log "Starting worker in foreground..."
    Write-Log "Press Ctrl+C to stop"
    Write-Host ""

    try {
        & node $nodeArgs
    } catch {
        Write-Log "Worker stopped: $_" "WARN"
    }
}
