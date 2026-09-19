# Build script for ClipFlow C++ Desktop Companion
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " Building ClipFlow Qt C++ Desktop Companion  " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

$BuildDir = Join-Path $PSScriptRoot "build"
if (!(Test-Path $BuildDir)) {
    New-Item -ItemType Directory -Path $BuildDir | Out-Null
}

Set-Location $BuildDir

# Run CMake configuration & build
cmake .. -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release
if ($LASTEXITCODE -eq 0) {
    cmake --build . --config Release
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n[Success] ClipFlowHelper.exe built successfully in $BuildDir" -ForegroundColor Green
    } else {
        Write-Host "`n[Error] Build failed." -ForegroundColor Red
    }
} else {
    Write-Host "`n[Notice] CMake configuration using default generator..." -ForegroundColor Yellow
    cmake ..
    cmake --build .
}
