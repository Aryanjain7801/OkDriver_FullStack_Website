@echo off
echo ========================================================
echo Starting okDriver CCTV Monitoring & Video Analytics App
echo ========================================================

REM Add node to path if present in scratch
if exist "%~dp0..\nodejs\node.exe" (
    set "PATH=%~dp0..\nodejs;%PATH%"
)

start "okDriver Backend Server" /min cmd /c "node server.js"

echo Waiting for server to initialize...
timeout /t 2 /nobreak >nul

echo Opening okDriver Dashboard in browser...
start http://localhost:3000

echo Done! The okDriver platform is live at http://localhost:3000
