# News Images Setup

This setup automatically fetches legally-usable images for your news stories using the Openverse API (Creative Commons).

## Installation

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements-images.txt
   ```

2. **Run news fetch with images:**
   ```bash
   # Regular news fetch (no images)
   python scripts/fetch_news.py
   
   # News fetch WITH images
   python scripts/fetch_news.py --images
   
   # Or use the batch file on Windows
   fetch_news_with_images.bat
   ```

## How it works

- **Legal compliance**: Only fetches CC0, Public Domain, and other commercially-usable images
- **Smart search**: Extracts keywords from news titles/summaries to find relevant images  
- **Caching**: Stores images locally and in SQLite database to avoid re-downloading
- **Attribution**: Properly credits creators and includes license information
- **Optimization**: Creates web-optimized thumbnails (900px max dimension)

## File structure

```
docs/
├── assets/
│   └── news_images/
│       ├── story-slug-1/
│       │   ├── image.jpg      # Original image
│       │   └── image_900.jpg  # Web thumbnail
│       └── story-slug-2/
│           ├── image.jpg
│           └── image_900.jpg
├── news_feed.json             # News data with image paths
└── ...

scripts/
├── fetch_news.py              # Enhanced with --images flag
├── legal_news_image.py        # Image fetching logic
└── ...

news_images.sqlite3            # Image metadata cache
```

## Usage tips

- Run `--images` flag occasionally (not every fetch) since image search can be slow
- Images are cached, so re-running won't re-download existing images  
- The script gracefully handles missing dependencies or API failures
- Images appear in the news widget automatically when available

## Troubleshooting

**Import errors**: Make sure you've installed the requirements:
```bash
pip install requests python-slugify Pillow
```

**API failures**: The script continues working without images if Openverse API is down

**No images found**: Some news stories may not have good keyword matches - this is normal