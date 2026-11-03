@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在部署到线上（需要能连上 GitHub，失败会自动重试）...
node .workbuddy\deploy.cjs
if errorlevel 1 (
  echo.
  echo 这次没成功：多半是网络连不上 GitHub，过一会儿再双击本文件即可。
) else (
  echo.
  echo 已推送，等 1-2 分钟 Cloudflare 自动构建完成后刷新网页即可。
)
pause
