@echo off
REM Floating Glass Dual Model Chat - Quick Start Script (Windows)

echo ================================================
echo   Floating Glass Dual Model Chat
echo   Quick Start Script
echo ================================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [X] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js found
node --version
echo.

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [X] npm is not installed!
    pause
    exit /b 1
)

echo [OK] npm found
npm --version
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

REM Create directories if they don't exist
echo Creating directories...
if not exist "notes" mkdir notes
if not exist "memory" mkdir memory
if not exist "exports" mkdir exports
echo [OK] Directories ready
echo.

REM Start the server
echo Starting server...
echo ================================================
echo.
echo Open your browser to:
echo   http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo.
echo ================================================
echo.

node server.js
