@echo off
title PharmaChain - MongoDB Viewer
echo ============================================
echo   PharmaChain MongoDB Viewer
echo   Database: mongodb://127.0.0.1:27017/pharmachain
echo ============================================
echo.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo Reading all collections from MongoDB...
echo.
node scripts/view-db.mjs
echo.
pause

