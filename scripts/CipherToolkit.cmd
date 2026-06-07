@echo off
chcp 65001 >nul
title 密码学工具箱
cd /d "%~dp0"
echo.
echo   密码学工具箱 - 正在启动...
echo   若浏览器未自动打开，请访问 http://127.0.0.1:3001
echo.
set DESKTOP_CONSOLE=1
CipherToolkit.exe
echo.
if errorlevel 1 echo   启动失败，请查看 desktop.log
pause
