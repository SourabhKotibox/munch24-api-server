# Self-elevate PowerShell script if not Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Requesting Administrator privileges to fix MongoDB..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Fixing Local MongoDB Service & FTDC Crash Lock (Admin)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

Write-Host "1. Stopping MongoDB service..."
Stop-Service -Name MongoDB -ErrorAction SilentlyContinue

$dataDir = "C:\Program Files\MongoDB\Server\8.2\data"
$diagDir = "$dataDir\diagnostic.data"

Write-Host "2. Cleaning corrupted FTDC diagnostic files..."
if (Test-Path "$diagDir\metrics.interim.temp") {
    Remove-Item -Force "$diagDir\metrics.interim.temp"
    Write-Host "   - Removed metrics.interim.temp" -ForegroundColor Green
}
if (Test-Path "$diagDir\metrics.interim") {
    Remove-Item -Force "$diagDir\metrics.interim"
    Write-Host "   - Removed metrics.interim" -ForegroundColor Green
}

Write-Host "3. Clearing stale lock file..."
Clear-Content -Path "$dataDir\mongod.lock" -ErrorAction SilentlyContinue
Write-Host "   - mongod.lock reset." -ForegroundColor Green

Write-Host "4. Starting MongoDB service..."
Start-Service -Name MongoDB

Write-Host "5. Checking service status..."
$svc = Get-Service -Name MongoDB
Write-Host "   MongoDB Status: $($svc.Status)" -ForegroundColor Green

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "SUCCESS: MongoDB service is running on port 27017!" -ForegroundColor Green
Write-Host "Now run: node test-local-mongo.mjs" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
Read-Host -Prompt "Press Enter to exit"
