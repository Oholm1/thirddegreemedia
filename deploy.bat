@echo off
if "%1"=="" (
    echo Usage: deploy.bat "commit message"
    exit /b 1
)
git add -A
git commit -m "%*"
git push
git push vps main
echo.
echo ✅ Deployed to both GitHub and VPS!