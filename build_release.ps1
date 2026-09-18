# ClipFlow Master Production Release Script
# Builds Frontend, Backend, and Packages the Desktop Companion App into release/

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "    Building ClipFlow Production Release Package" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$RootDir = $PSScriptRoot
$ReleaseDir = Join-Path $RootDir "release"
$FrontendDir = Join-Path $RootDir "frontend"
$BackendDir = Join-Path $RootDir "backend"
$QtAppDir = Join-Path $RootDir "qt-app"

# Ensure release directory exists
New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null

# 1. Build Frontend Production Bundle
Write-Host "`n[1/3] Building Frontend Production Web App (Vite + React)..." -ForegroundColor Yellow
Set-Location $FrontendDir
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Frontend build failed!" -ForegroundColor Red
    exit 1
}

# 2. Build Backend Production TypeScript
Write-Host "`n[2/3] Building Backend Production Server..." -ForegroundColor Yellow
Set-Location $BackendDir
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Backend build failed!" -ForegroundColor Red
    exit 1
}

# 3. Build Standalone Desktop Companion (.exe & .zip)
Write-Host "`n[3/3] Packaging ClipFlow Desktop Companion..." -ForegroundColor Yellow
Set-Location $QtAppDir
python package_app.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Desktop Companion packaging failed!" -ForegroundColor Red
    exit 1
}

Set-Location $RootDir
Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "  ClipFlow Production Build Complete!" -ForegroundColor Green
Write-Host "  Release Assets in: $ReleaseDir" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
