@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Electron wordt eenmalig geinstalleerd...
  call npm install || exit /b 1
)
call npm start
