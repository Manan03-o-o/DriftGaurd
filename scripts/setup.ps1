<#
.SYNOPSIS
    DriftGuard Local Development Setup Script for Windows PowerShell.
.DESCRIPTION
    Validates Python and Node.js runtimes, provisions Python virtual environment,
    installs backend dependencies, installs frontend packages, and runs health checks.
    Does NOT alter system-wide execution policies or delete user files.
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   DriftGuard: Automated Windows Development Setup        " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check Python runtime
Write-Host "`n[1/5] Checking Python availability..." -ForegroundColor Yellow
try {
    $pythonVersionOutput = python --version 2>&1
    Write-Host "  Found: $pythonVersionOutput" -ForegroundColor Green
} catch {
    Write-Error "Python was not found in PATH. Please install Python 3.10+ and re-run this script."
    exit 1
}

# 2. Check Node.js and npm
Write-Host "`n[2/5] Checking Node.js and npm availability..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    $npmVersion = npm --version
    Write-Host "  Found Node.js: $nodeVersion | npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Error "Node.js or npm was not found in PATH. Please install Node.js (v18+) and re-run this script."
    exit 1
}

# 3. Setup Python Virtual Environment
Write-Host "`n[3/5] Setting up Python virtual environment (.venv)..." -ForegroundColor Yellow
$rootPath = Split-Path -Parent $PSScriptRoot
Set-Location $rootPath

if (-not (Test-Path ".\.venv")) {
    Write-Host "  Creating virtual environment at .venv..." -ForegroundColor Gray
    python -m venv .venv
} else {
    Write-Host "  Virtual environment already exists at .venv" -ForegroundColor Gray
}

$venvPython = ".\.venv\Scripts\python.exe"
$venvPip = ".\.venv\Scripts\pip.exe"

Write-Host "  Installing backend requirements from backend/requirements.txt..." -ForegroundColor Gray
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r backend/requirements.txt

# 4. Setup Frontend npm dependencies
Write-Host "`n[4/5] Setting up Frontend npm packages..." -ForegroundColor Yellow
Set-Location "$rootPath\frontend"
npm install
Set-Location $rootPath

# 5. Run Backend Verification Tests
Write-Host "`n[5/5] Running core verification tests..." -ForegroundColor Yellow
$pytestExe = ".\.venv\Scripts\pytest.exe"
& $pytestExe backend/tests -v

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " DriftGuard Setup Completed Successfully!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "`nTo start the platform in separate terminals (recommended for Windows):" -ForegroundColor Cyan
Write-Host "  Terminal 1 (Backend API):" -ForegroundColor White
Write-Host "    .\.venv\Scripts\Activate.ps1" -ForegroundColor Yellow
Write-Host "    python -m uvicorn app.main:app --app-dir backend --reload --port 8000`n" -ForegroundColor Yellow

Write-Host "  Terminal 2 (Frontend React Dashboard):" -ForegroundColor White
Write-Host "    cd frontend" -ForegroundColor Yellow
Write-Host "    npm run dev`n" -ForegroundColor Yellow
