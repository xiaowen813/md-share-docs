@echo off
chcp 65001 >nul
title MD Share - 开发服务器
cd /d "%~dp0"
echo 正在启动开发服务器，请稍候...
echo 启动后浏览器打开 http://localhost:5173 （如果没自动弹出）
echo 关闭本窗口 = 停止服务器
echo.
npm run dev
pause
