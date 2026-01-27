# =============================================================================
# Phase 1: Digital Floor - Stop Script
# =============================================================================

param(
    [switch]$RemoveVolumes
)

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   R&G Digital Floor - Stopping" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$composeArgs = @("-f", "docker-compose.phase1.yml", "down")

if ($RemoveVolumes) {
    Write-Host "WARNING: Removing volumes will delete all data!" -ForegroundColor Red
    $confirm = Read-Host "Type 'yes' to confirm"
    if ($confirm -eq "yes") {
        $composeArgs += "-v"
    } else {
        Write-Host "Aborted." -ForegroundColor Yellow
        exit 0
    }
}

docker compose @composeArgs

Write-Host "`nAll services stopped." -ForegroundColor Green
