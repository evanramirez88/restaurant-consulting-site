# Toast ABO Worker Installation Script
# R&G Consulting LLC - Toast Auto-Back-Office Automation
#
# This script installs all dependencies and prepares the environment
# for running the Toast ABO Worker on Windows.
#
# Usage:
#   .\install.ps1
#   .\install.ps1 -SkipBrowserInstall  # Skip Puppeteer browser download
#
# Requirements:
#   - Node.js 20+ installed
#   - PowerShell 5.1 or later

param(
    [switch]$SkipBrowserInstall = $false
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

# Banner
Write-Host @"

===============================================================================
  Toast ABO Worker Installation
  R&G Consulting LLC
===============================================================================

"@ -ForegroundColor Cyan

# Check Node.js version
Write-Step "Checking Node.js installation..."
try {
    $nodeVersion = node --version
    $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($versionNumber -lt 20) {
        Write-Error "Node.js 20+ required, found $nodeVersion"
        Write-Host "  Download from: https://nodejs.org/" -ForegroundColor Yellow
        exit 1
    }
    Write-Success "Node.js $nodeVersion found"
} catch {
    Write-Error "Node.js not found. Please install Node.js 20+ from https://nodejs.org/"
    exit 1
}

# Change to project root
Set-Location $rootPath
Write-Step "Working directory: $rootPath"

# Install npm dependencies
Write-Step "Installing npm dependencies..."
try {
    npm install --omit=dev
    Write-Success "Dependencies installed"
} catch {
    Write-Error "npm install failed: $_"
    exit 1
}

# Install Puppeteer browsers
if (-not $SkipBrowserInstall) {
    Write-Step "Installing Puppeteer browsers (this may take a few minutes)..."
    try {
        npx puppeteer browsers install chrome
        Write-Success "Chrome browser installed for Puppeteer"
    } catch {
        Write-Warning "Browser installation failed - you may need to install manually"
        Write-Host "  Run: npx puppeteer browsers install chrome" -ForegroundColor Yellow
    }
} else {
    Write-Warning "Skipping browser installation (-SkipBrowserInstall flag set)"
}

# Create .env file from template if not exists
Write-Step "Checking environment configuration..."
$envPath = Join-Path $rootPath ".env"
$envExamplePath = Join-Path $rootPath ".env.example"

if (-not (Test-Path $envPath)) {
    if (Test-Path $envExamplePath) {
        Copy-Item $envExamplePath $envPath
        Write-Success "Created .env file from template"
        Write-Warning "IMPORTANT: Edit .env with your configuration before starting the worker"
    } else {
        Write-Warning ".env.example not found - creating minimal .env"
        @"
# Toast ABO Worker Configuration
# Fill in your values below

API_BASE_URL=https://ccrestaurantconsulting.com
WORKER_API_KEY=your-worker-api-key-here
ENCRYPTION_KEY=your-encryption-key-here
HEADLESS=true
MAX_SESSIONS=2
LOG_LEVEL=info
"@ | Out-File -FilePath $envPath -Encoding UTF8
        Write-Warning "IMPORTANT: Edit .env with your configuration before starting the worker"
    }
} else {
    Write-Success ".env file already exists"
}

# Create screenshots directory
Write-Step "Creating required directories..."
$screenshotsPath = Join-Path $rootPath "screenshots"
if (-not (Test-Path $screenshotsPath)) {
    New-Item -ItemType Directory -Path $screenshotsPath -Force | Out-Null
    Write-Success "Created screenshots directory"
} else {
    Write-Success "Screenshots directory exists"
}

# Create logs directory
$logsPath = Join-Path $rootPath "logs"
if (-not (Test-Path $logsPath)) {
    New-Item -ItemType Directory -Path $logsPath -Force | Out-Null
    Write-Success "Created logs directory"
} else {
    Write-Success "Logs directory exists"
}

# Verify installation
Write-Step "Verifying installation..."
$packageJsonPath = Join-Path $rootPath "package.json"
$workerPath = Join-Path $rootPath "src\worker.js"

if (Test-Path $packageJsonPath) {
    Write-Success "package.json found"
} else {
    Write-Error "package.json not found"
}

if (Test-Path $workerPath) {
    Write-Success "Worker script found"
} else {
    Write-Error "Worker script not found at $workerPath"
}

# Summary
Write-Host @"

===============================================================================
  Installation Complete!
===============================================================================

Next Steps:
  1. Edit .env with your configuration:
     - WORKER_API_KEY: Get from Cloudflare dashboard
     - ENCRYPTION_KEY: Must match backend key

  2. Test the connection:
     npm test

  3. Start the worker:
     npm start
     (or use .\scripts\start.ps1)

  4. (Optional) Install as Windows Service:
     .\scripts\install-service.ps1

Documentation: https://github.com/evanramirez88/restaurant-consulting-site

"@ -ForegroundColor Green
