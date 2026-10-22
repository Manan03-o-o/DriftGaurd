<#
.SYNOPSIS
    DriftGuard Demo Runner Script for Windows.
.DESCRIPTION
    Starts the FastAPI backend and Vite frontend, then opens the dashboard in your default browser.
#>

[CmdletBinding()]
param()

$rootPath = Split-Path -Parent $PSScriptRoot
Set-Location $rootPath

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Starting DriftGuard Full-Stack Platform...            " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$backendCommand = "cd '$rootPath'; .\.venv\Scripts\Activate.ps1; python -m uvicorn app.main:app --app-dir backend --port 8000 --reload"
$frontendCommand = "cd '$rootPath\frontend'; npm run dev"

Write-Host "`nStarting Backend on http://localhost:8000 in a new PowerShell window..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCommand

Write-Host "Starting Frontend on http://localhost:5173 in a new PowerShell window..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCommand

Write-Host "`nWaiting 4 seconds for servers to initialize..." -ForegroundColor Gray
Start-Sleep -Seconds 4

Write-Host "Opening DriftGuard Dashboard at http://localhost:5173 ..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host "`nDriftGuard is running! Press Ctrl+C in either terminal window to stop." -ForegroundColor Cyan
