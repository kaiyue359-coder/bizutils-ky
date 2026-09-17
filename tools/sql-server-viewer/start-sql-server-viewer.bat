@echo off
chcp 65001 >nul
setlocal
title SQL Server Viewer

cd /d "%~dp0"

echo SQL Server Viewer
echo.
echo Current directory: %CD%
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Please install Node.js 20 or later.
  echo Download: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Please check your Node.js installation.
  echo.
  pause
  exit /b 1
)

if not exist package.json (
  echo This is not the SQL Server Viewer tool directory. package.json was not found.
  echo Please run this bat file from the tools\sql-server-viewer directory.
  echo.
  pause
  exit /b 1
)

if not exist .env (
  if exist .env.example (
    echo .env was not found. Creating it from .env.example.
    copy .env.example .env >nul
    echo To connect to a real SQL Server, edit .env and fill in your read-only account.
    echo.
  )
)

if not exist node_modules (
  echo First run detected. Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo Dependency installation failed. Please review the error above.
    pause
    exit /b 1
  )
  echo.
)

echo Starting local services...
echo URL: http://127.0.0.1:5173/
echo.
echo Keep this window open while using SQL Server Viewer.
echo Closing this window stops the viewer.
echo.

start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Sleep -Seconds 8; Start-Process 'http://127.0.0.1:5173/'"

call npm run dev

echo.
echo Services stopped.
pause
