@echo off
title PharmaChain App
echo ============================================
echo    PharmaChain - Starting application...
echo ============================================
echo.

cd /d "%~dp0"

REM Check if node is installed
where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo node_modules not found. Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed.
        pause
        exit /b 1
    )
)

REM ALWAYS rebuild so the service-worker cache never serves stale/missing assets.
echo Rebuilding PharmaChain (fresh assets)...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed.
    pause
    exit /b 1
)

REM Seed MongoDB with demo users if empty
echo Ensuring demo data is seeded in MongoDB...
call npm run seed
if errorlevel 1 (
    echo WARNING: Seed step had issues, continuing anyway...
)

REM Clear any stale service-worker caches so a previous build can't show a blank screen.
echo Cleaning stale service-worker caches...
if exist "%LOCALAPPDATA%\pharmachain" (
    rmdir /s /q "%LOCALAPPDATA%\pharmachain" 2>nul
)
if exist "%USERPROFILE%\.cache\pharmachain" (
    rmdir /s /q "%USERPROFILE%\.cache\pharmachain" 2>nul
)

REM Kill any orphaned server already listening on 41837 (prevents old static/Electron server conflicts).
echo Checking port 41837...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":41837" ^| findstr "LISTENING"') do (
    echo Killing orphaned process on port 41837 (PID %%a)...
    taskkill /F /PID %%a >nul 2>nul
)
timeout /t 1 /nobreak >nul

echo.
echo Starting PharmaChain backend (Express + MongoDB) on port 41837...
echo.
start "PharmaChain Backend" cmd /k "cd /d %~dp0 && npm run dev:server"

echo Waiting for backend to be ready...
timeout /t 5 /nobreak >nul

echo.
echo Starting PharmaChain desktop app...
echo Close the backend console window to stop the server.
echo.

REM Launch the native desktop app (Electron window pointed at the backend)
call npm run app
pause

           