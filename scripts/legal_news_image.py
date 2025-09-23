#!/usr/bin/env python3
"""
legal_news_image.py
Fetch a legally-usable image for a news story using Openverse (CC/Public Domain),
store metadata in SQLite, download the file, and emit HTML with attribution.

Usage:
  python legal_news_image.py \
    --title "Tor Project releases new Snowflake update" \
    --summary "Performance improvements and anti-censorship tweaks..." \
    --tags "privacy,tor,censorship" \
    --outdir ./docs/assets/news_images

Dependencies:
  pip install requests python-slugify Pillow

Notes:
  - Openverse API docs: https://api.openverse.engineering/v1/
  - Filters: commercial use + modifications allowed (safe for most sites)
  - Licenses prioritized: publicdomain, cc0, by, by-sa
"""

import argparse, os, re, sqlite3, textwrap, time
from collections import Counter
from urllib.parse import quote_plus
from io import BytesIO

import requests
from slugify import slugify
from PIL import Image

DB_PATH = os.getenv("NEWS_IMG_DB", "news_images.sqlite3")
USER_AGENT = "ThirdDegreeMedia/1.0 (legal_news_image.py)"

STOPWORDS = set("""
a about above after again against all am an and any are as at be because been
before being below between both but by could did do does doing down during each
few for from further had has have having he her here hers herself him himself his
how i if in into is it its itself let me more most my myself nor of on once only
or other our ours ourselves out over own same she should so some such than that
the their theirs them themselves then there these they this those through to too
under until up very was we were what when where which while who whom why with you
your yours yourself yourselves
""".split())

LICENSE_PRIORITY = {
    "publicdomain": 5, "cc0": 5,
    "by": 4, "by-sa": 4,
    "by-nd": 3, "by-nc": 2, "by-nc-sa": 2, "by-nc-nd": 1
}

def ensure_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      story_slug TEXT NOT NULL,
      title TEXT,
      creator TEXT,
      license TEXT,
      license_url TEXT,
      source TEXT,
      source_url TEXT,
      thumb_path TEXT,
      file_path TEXT,
      width INTEGER,
      height INTEGER,
      created_at INTEGER,
      UNIQUE(story_slug)
    )
    """)
    conn.commit()
    return conn

def tokenize(text):
    words = re.findall(r"[A-Za-z0-9''\-]+", (text or "").lower())
    return [w for w in words if w not in STOPWORDS and len(w) > 2]

def top_keywords(title, summary, tags, k=6):
    tokens = tokenize(title) + tokenize(summary) + [t.strip().lower() for t in (tags or []) if t.strip()]
    counts = Counter(tokens)
    return [w for w,_ in counts.most_common(k)]

def openverse_search(query, page_size=15):
    url = "https://api.openverse.engineering/v1/images/"
    params = {
        "q": query,
        "page_size": page_size,
        "license_type": "commercial",         # allow commercial use
        "license": ",".join(["cc0","pdm","by","by-sa","by-nd","by-nc","by-nc-sa","by-nc-nd"]),
        "mature": "false"
    }
    headers = {"User-Agent": USER_AGENT}
    r = requests.get(url, params=params, headers=headers, timeout=15)
    r.raise_for_status()
    return r.json().get("results", [])

def score_result(item, title_terms):
    lic = (item.get("license") or "").lower()
    # Normalize pdm to publicdomain
    if lic in ("pdm", "public-domain", "publicdomain"):
        lic = "publicdomain"
    lic_score = LICENSE_PRIORITY.get(lic, 0)

    width = item.get("width") or 0
    height = item.get("height") or 0
    res_score = min(width, height) / 1000.0  # small boost for decent size

    text = ((item.get("title") or "") + " " + (item.get("tags") or "")).lower()
    hit_score = sum(2 if t in (item.get("title") or "").lower() else (1 if t in text else 0) for t in title_terms)

    # Prefer providers that are easy to attribute/rehost safely
    provider = (item.get("provider") or "").lower()
    provider_bonus = 0.5 if provider in ("wikimedia", "flickr") else 0.0

    return lic_score*3 + res_score + hit_score + provider_bonus

def download_image(url, out_path):
    headers = {"User-Agent": USER_AGENT, "Referer": "https://api.openverse.engineering"}
    r = requests.get(url, headers=headers, timeout=20)
    r.raise_for_status()
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "wb") as f:
        f.write(r.content)
    return out_path

def make_thumbnail(in_path, thumb_path, max_side=900):
    with Image.open(in_path) as im:
        im = im.convert("RGB")
        w, h = im.size
        scale = max_side / float(max(w, h))
        if scale < 1.0:
            new_size = (int(w*scale), int(h*scale))
            im = im.resize(new_size, Image.LANCZOS)
        os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
        im.save(thumb_path, "JPEG", quality=88, optimize=True, progressive=True)
        return thumb_path, im.size

def build_attribution_html(meta, alt_text):
    """
    Returns a <figure> with attribution and license.
    """
    title = meta.get("title") or "Image"
    creator = meta.get("creator") or "Unknown"
    source_url = meta.get("source_url") or meta.get("provider_url") or "#"
    license_name = (meta.get("license") or "").upper()
    license_url = meta.get("license_url") or "#"
    img_src = meta.get("thumb_path") or meta.get("file_path")

    caption = f'{title} by {creator} via <a href="{source_url}" rel="noopener nofollow">source</a> · Licensed {license_name}'
    if license_url and license_url != "#":
        caption = f'{title} by {creator} via <a href="{source_url}" rel="noopener nofollow">source</a> · <a href="{license_url}" rel="license noopener nofollow">{license_name}</a>'

    html = f"""
<figure class="news-image">
  <img src="{img_src}" alt="{alt_text}" loading="lazy" decoding="async">
  <figcaption>{caption}</figcaption>
</figure>
""".strip()
    return html

def choose_and_save(title, summary, tags, outdir, prefer_square=False):
    # 1) Slug for caching
    story_slug = slugify(title)[:120] or f"story-{int(time.time())}"
    conn = ensure_db()
    cur = conn.cursor()

    # 2) Cache hit?
    cur.execute("SELECT * FROM images WHERE story_slug=?", (story_slug,))
    row = cur.fetchone()
    if row:
        # Build HTML from stored metadata
        cols = [c[1] for c in cur.execute("PRAGMA table_info(images)")]
        meta = dict(zip(cols, row))
        alt_text = title
        html = build_attribution_html(meta, alt_text)
        return html, meta

    # 3) Search
    terms = top_keywords(title, summary, tags)
    query = " ".join(terms) or title
    results = openverse_search(query)

    if not results:
        # Try again with only title words
        results = openverse_search(title)

    if not results:
        raise SystemExit("No images found from Openverse for this query.")

    # 4) Rank & choose
    scores = [(score_result(r, terms), r) for r in results]
    scores.sort(key=lambda x: x[0], reverse=True)
    best = scores[0][1]

    # 5) Download best (use full-size url, fallback to thumbnail)
    raw_url = best.get("url") or best.get("thumbnail")
    if not raw_url:
        raise SystemExit("Best result missing URL.")

    base_dir = os.path.join(outdir, story_slug)
    file_path = os.path.join(base_dir, "image.jpg")
    thumb_path = os.path.join(base_dir, "image_900.jpg")

    download_image(raw_url, file_path)
    thumb_path, (w,h) = make_thumbnail(file_path, thumb_path, max_side=900)

    # 6) Persist metadata
    lic = (best.get("license") or "").lower()
    if lic in ("pdm", "public-domain"):
        lic = "publicdomain"

    meta = {
        "story_slug": story_slug,
        "title": best.get("title") or "",
        "creator": best.get("creator") or (best.get("creator_url") or "Unknown"),
        "license": lic,
        "license_url": best.get("license_url") or "",
        "source": best.get("provider") or "",
        "source_url": best.get("foreign_landing_url") or best.get("creator_url") or "",
        "thumb_path": thumb_path.replace("\\", "/"),
        "file_path": file_path.replace("\\", "/"),
        "width": int(best.get("width") or w),
        "height": int(best.get("height") or h),
        "created_at": int(time.time())
    }

    cur.execute("""
    INSERT OR REPLACE INTO images
    (story_slug,title,creator,license,license_url,source,source_url,thumb_path,file_path,width,height,created_at)
    VALUES (:story_slug,:title,:creator,:license,:license_url,:source,:source_url,:thumb_path,:file_path,:width,:height,:created_at)
    """, meta)
    conn.commit()

    # 7) Emit HTML
    alt_text = title
    html = build_attribution_html(meta, alt_text)
    return html, meta

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", required=True, help="Story title")
    ap.add_argument("--summary", default="", help="Story summary/lede paragraph")
    ap.add_argument("--tags", default="", help="Comma-separated tags")
    ap.add_argument("--outdir", default="./news_images", help="Where to save images")
    args = ap.parse_args()

    tags = [t.strip() for t in args.tags.split(",") if t.strip()]
    html, meta = choose_and_save(args.title, args.summary, tags, args.outdir)
    print(html)

if __name__ == "__main__":
    main()