@echo off
title ClipFlow Production Server
cd /d "%~dp0backend"

echo ==================================================
echo   Starting ClipFlow Production Server
echo   App URL: http://localhost:3001
echo ==================================================

node dist/index.js
pause
