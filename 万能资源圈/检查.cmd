@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo  全站自检（不会改动任何文件）
echo ========================================
echo.
echo [1/2] 规范自检（越界字号/圆角/死样式/文案口径）...
node tools\lint.cjs
echo.
echo [2/2] 真机巡检（组件一致性 / 无障碍 / 响应式 / 关键交互）
node tools\check\run-all.cjs
echo.
pause
