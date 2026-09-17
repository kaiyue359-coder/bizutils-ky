@echo off
chcp 65001 >nul
setlocal
title SQL Server Viewer

cd /d "%~dp0"

echo SQL Server Viewer
echo.
echo 当前目录：%CD%
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js。请先安装 Node.js 20 或更高版本。
  echo 下载地址：https://nodejs.org/
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo 未找到 npm。请确认 Node.js 已正确安装。
  echo.
  pause
  exit /b 1
)

if not exist package.json (
  echo 当前目录不是 SQL Server Viewer 工具目录，未找到 package.json。
  echo 请把本 bat 文件放在 tools\sql-server-viewer 目录内再运行。
  echo.
  pause
  exit /b 1
)

if not exist .env (
  if exist .env.example (
    echo 未找到 .env，已根据 .env.example 创建一份。
    copy .env.example .env >nul
    echo 如需连接真实 SQL Server，请先编辑 .env 填写自己的只读账号。
    echo.
  )
)

if not exist node_modules (
  echo 首次运行，正在安装依赖...
  call npm install
  if errorlevel 1 (
    echo.
    echo 依赖安装失败，请查看上方错误信息。
    pause
    exit /b 1
  )
  echo.
)

echo 正在启动本地服务...
echo 地址：http://127.0.0.1:5173/
echo.
echo 请保持本窗口开启；关闭本窗口会停止 Viewer。
echo.

start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Sleep -Seconds 8; Start-Process 'http://127.0.0.1:5173/'"

call npm run dev

echo.
echo 服务已停止。
pause
