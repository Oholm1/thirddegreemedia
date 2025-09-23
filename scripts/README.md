# RSS News Aggregator

This script fetches privacy/civil liberties news from multiple RSS feeds and creates a consolidated `news.json` file for your website.

## Features

- **Privacy-focused**: Users fetch only your JSON, not third-party feeds
- **Deduplication**: Removes duplicate articles by URL
- **Source attribution**: Tracks which feed each article came from
- **Safe parsing**: Strips HTML, truncates summaries, handles errors gracefully
- **Date sorting**: Most recent articles first

## Sources

- **EFF** (Electronic Frontier Foundation)
- **Tor Project** blog
- **ProPublica** Nerds/News
- **Mullvad** VPN blog
- **Mozilla Security** Blog

## Usage

```bash
# Install Python 3.6+ if not already installed
python3 scripts/fetch_news.py

# Or with Windows py launcher
py scripts/fetch_news.py
```

## Output

Creates `docs/news.json` with structure:
```json
{
  "last_updated": "2025-09-23T18:30:00Z",
  "items": [
    {
      "title": "Article Title",
      "url": "https://example.com/article",
      "source": "EFF",
      "date": "2025-09-23T12:00:00Z",
      "summary": "Article summary..."
    }
  ]
}
```

## Configuration

Edit `FEEDS` array in the script to add/remove RSS sources.

## Automation

Consider running via cron/scheduled task:
```bash
# Run every 4 hours
0 */4 * * * cd /path/to/thirddegreemedia && python3 scripts/fetch_news.py
```

## Integration

The generated JSON can be consumed by JavaScript on your website to display a news feed without making cross-origin requests to RSS feeds.