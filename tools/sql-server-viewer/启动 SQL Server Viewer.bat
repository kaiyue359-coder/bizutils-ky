@echo off
chcp 65001 >nul
title SQL Server Viewer

cd /d "%~dp0"

echo SQL Server Viewer
echo.
echo 正在启动本地服务...
echo 地址：http://127.0.0.1:5173/
echo.
echo 请保持本窗口开启；关闭本窗口会停止 Viewer。
echo.

start "" powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 5; Start-Process 'http://127.0.0.1:5173/'"

npm run dev

echo.
echo 服务已停止。
pause
