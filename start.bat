@echo off
title PHANTOM — Media Server
color 0A

echo.
echo  ==============================================
echo    PHANTOM - Local Media Server
echo  ==============================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python not found. Install from https://python.org
    pause
    exit /b 1
)

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

:: Check FFmpeg
ffmpeg -version >nul 2>&1
if errorlevel 1 (
    echo  [WARN] FFmpeg not found in PATH. Thumbnails will be disabled.
    echo  Download from https://ffmpeg.org and add to PATH.
    echo.
)

:: Install Python dependencies
echo  [1/3] Installing Python dependencies...
cd /d "%~dp0backend"
pip install -r requirements.txt --quiet
pip install pystray Pillow --quiet

:: Build frontend if not built
echo  [2/3] Building frontend...
cd /d "%~dp0frontend"
if not exist node_modules (
    echo        Installing npm packages...
    call npm install --silent
)
call npm run build

:: Start server in system tray
echo  [3/3] Starting PHANTOM server in System Tray...
echo  Look for the icon in your taskbar notification area (bottom-right).
echo.
cd /d "%~dp0"
start "" pythonw launcher.pyw
timeout /t 2 /nobreak >nul
exit
