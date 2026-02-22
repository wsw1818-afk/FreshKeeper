@echo off
cd /d "%~dp0"
echo [DEBUG] Starting Expo with logging...
npx expo start --dev-client > debug.log 2>&1
echo [DEBUG] Log saved to debug.log
pause
