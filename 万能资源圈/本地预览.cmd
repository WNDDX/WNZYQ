@echo off
chcp 65001 >nul
title 万能资源圈 · 本地预览（模拟数据）
cd /d "%~dp0"
echo.
echo   正在启动本地预览站（模拟数据，不连线上数据库）...
echo   店铺：http://127.0.0.1:8899/shop
echo   后台：http://127.0.0.1:8899/admin.html （随便填账号密码即可进）
echo.
echo   关掉这个黑窗口就停止预览。
echo.
start "" http://127.0.0.1:8899/shop
node "..\万能资源圈-站外文档\万能资源圈-工作档案\dev\local-mock.cjs"
pause
