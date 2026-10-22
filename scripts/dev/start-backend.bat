@echo off
cd /d "%~dp0..\.."
set NODE_ENV=development
node server\index.cjs