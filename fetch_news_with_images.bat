@echo off
REM Run news fetch with images
REM Make sure to install dependencies first: pip install -r requirements-images.txt

cd /d "%~dp0"
echo Fetching news with images...
python scripts\fetch_news.py --images
echo Done! Check docs\news_feed.json and docs\assets\news_images\