@echo off
title S Hub
cd /d "%~dp0"
echo ============================================
echo   Starting your S Hub app...
echo   Your browser will open automatically.
echo.
echo   KEEP THIS WINDOW OPEN while using the app.
echo   Close it (or press Ctrl+C) to stop the app.
echo ============================================
echo.

REM Install dependencies the first time if they're missing.
if not exist "node_modules" (
  echo First run: installing dependencies, please wait...
  call npm install
)

REM --strictPort keeps the app on the SAME address (localhost:5173) every time,
REM so your sign-in is remembered between launches. If you see a "port in use"
REM error, the app is already running in another window — just use that one.
call npm run dev -- --open --port 5173 --strictPort
pause
