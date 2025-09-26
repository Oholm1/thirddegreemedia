@echo off
REM Run news fetch with images
REM Make sure to install dependencies first: pip install -r requirements-images.txt

cd /d "%~dp0"
echo Fetching news with images...
python scripts\fetch_news.py ^
    --feed "https://www.eff.org/rss/updates.xml" ^
    --feed "https://blog.torproject.org/rss.xml" ^
    --feed "https://www.propublica.org/feeds/nerds" ^
    --feed "https://mullvad.net/en/blog/rss/" ^
    --feed "https://blog.mozilla.org/security/feed/" ^
    --images ^
    --max 40
echo Done! Check docs\news_feed.json and docs\assets\news_images\