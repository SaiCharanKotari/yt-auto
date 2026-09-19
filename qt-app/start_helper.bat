@echo off
title ClipFlow Desktop Helper
cd /d "%~dp0"

if exist "build\ClipFlowHelper.exe" (
    start "" "build\ClipFlowHelper.exe"
    exit /b 0
)

if exist "bin\ClipFlowHelper.exe" (
    start "" "bin\ClipFlowHelper.exe"
    exit /b 0
)

python app.py
if %ERRORLEVEL% NEQ 0 (
    echo Installing PyQt6 requirements...
    pip install PyQt6
    python app.py
)
