@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在自检全站规范（不会改动任何文件）...
echo.
node tools\lint.cjs
echo.
pause
