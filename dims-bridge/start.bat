@echo off
REM DIMS Bridge launcher (Windows). Double-click to start.
REM First run installs dependencies; subsequent runs are instant.

cd /d "%~dp0"

if not exist node_modules (
  echo [DIMS Bridge] Installing dependencies on first run...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo Installation failed. Make sure Node.js 18+ is installed: https://nodejs.org/
    pause
    exit /b 1
  )
)

echo [DIMS Bridge] Starting on http://localhost:8182 ...
echo Leave this window open while you sync. Press Ctrl+C to stop.
echo.
node server.js
pause
